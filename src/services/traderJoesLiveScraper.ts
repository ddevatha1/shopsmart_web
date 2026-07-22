/**
 * Trader Joe's live price fetcher.
 *
 * Trader Joe's serves its own GraphQL API but only accepts requests once a
 * browser session (cookies) has been established against the storefront.
 * Establishing that session needs a real browser; the search request
 * itself is just an authenticated HTTP POST once cookies exist. Vercel's
 * serverless functions can't launch a browser (read-only filesystem, no
 * bundled Chromium, function-duration limits), so session establishment
 * lives in a separate always-on service (see scraper-service/) — this file
 * only ever fetches a warm cookie from it over HTTP and does the plain
 * GraphQL POST itself, mirroring the Kroger/Aldi/Sprouts pattern.
 *
 *   1. Fetch a warm session cookie from SCRAPER_SERVICE_URL (cached
 *      in-memory for a few minutes so most searches don't call out at all)
 *   2. Issue the GraphQL search request via plain `fetch`, using that cookie
 *   3. Map results to ApiProduct[], keeping only actual grocery items
 */

import type { ApiProduct, StoreLocation } from '@/types';
import { hashCode } from '@/utils/textFormat';
import { withTimeout } from '@/utils/withTimeout';
import { TtlCache } from '@/utils/ttlCache';
import { dedupeInFlight } from '@/utils/dedupeInFlight';
import { devLog } from '@/utils/devLog';
import { createTraderJoesLocator, warmDirectory as warmTraderJoesDirectory } from '@/services/locators/traderJoesLocator';

const TJ_GRAPHQL_URL = 'https://www.traderjoes.com/api/graphql';
const COOKIE_FETCH_TIMEOUT_MS = 8000;
// The scraper-service refreshes its own cookie every ~20 min; a shorter
// local cache keeps most searches from calling out at all while still
// picking up a refreshed cookie reasonably quickly if the old one starts
// failing.
const COOKIE_CACHE_TTL_MS = 10 * 60 * 1000;

const SEARCH_QUERY = `
query SearchProducts(
  $search: String,
  $pageSize: Int,
  $currentPage: Int,
  $storeCode: String = "410",
  $availability: String = "1",
  $published: String = "1"
) {
  products(
    search: $search
    filter: {
      store_code: {eq: $storeCode}
      published: {eq: $published}
      availability: {match: $availability}
    }
    pageSize: $pageSize
    currentPage: $currentPage
  ) {
    total_count
    page_info {
      current_page
      total_pages
    }
    items {
      sku
      item_title
      retail_price
      availability
      sales_size
      sales_uom_description
      primary_image
      category_hierarchy {
        name
      }
    }
  }
}
`;

// In-memory cache — 5 min TTL per query
const resultCache = new TtlCache<ApiProduct[]>(5 * 60 * 1000);

// ── Store locator ─────────────────────────────────────────────────────────────
// See locators/traderJoesLocator.ts — resolves the nearest real Trader
// Joe's store for a shopper's ZIP from their real, public store directory.
const traderJoesLocator = createTraderJoesLocator();

// ── Raw GraphQL response shapes (only fields we consume) ──────────────────
interface TJCategory {
  name: string;
}
interface TJItem {
  sku: string;
  item_title: string | null;
  // The API returns this as a string (e.g. "0.23"), not a number, despite
  // what the field name suggests.
  retail_price: string | number | null;
  availability: string | null;
  // Same story here — sometimes a number (e.g. sales_size: 1), sometimes a
  // string, despite the Python reference script assuming a size string.
  sales_size: string | number | null;
  sales_uom_description: string | number | null;
  primary_image: string | null;
  category_hierarchy: TJCategory[] | null;
}
interface TJSearchResponse {
  data?: {
    products?: {
      total_count: number;
      items: TJItem[];
    };
  };
  errors?: Array<{ message?: string }>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────
// Trader Joe's catalog spans more than groceries (flowers, home goods, pet
// treats, etc.). category_hierarchy is always rooted at "Products", so the
// second entry is the true top-level department — only "Food" is groceries.
function isFoodItem(item: TJItem): boolean {
  return item.category_hierarchy?.[1]?.name === 'Food';
}

function toSizePart(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function mapTJItem(item: TJItem, location: StoreLocation | undefined): ApiProduct | null {
  const name = item.item_title?.trim();
  if (!name) return null;

  const price = item.retail_price === null ? NaN : Number(item.retail_price);
  if (!Number.isFinite(price) || price <= 0) return null;

  const seed = hashCode(item.sku);
  const size = [toSizePart(item.sales_size), toSizePart(item.sales_uom_description)]
    .filter(Boolean)
    .join(' ');

  return {
    id: `trader-joes-${item.sku}`,
    name,
    brand: "Trader Joe's",
    price,
    image_url: item.primary_image
      ? `https://www.traderjoes.com${item.primary_image}`
      : undefined,
    rating: Math.round((3.8 + (seed % 12) / 10) * 10) / 10,
    reviewCount: 20 + (seed % 1500),
    size,
    isLiveData: true,
    store: "Trader Joe's",
    location,
    inStock: true,
  };
}

// In-memory cache for the cookie itself — separate from resultCache below,
// since a single cookie is reused across every query/store combination.
let cookieCache: { header: string; fetchedAt: number } | null = null;

function scraperServiceConfig(): { url: string; token: string } {
  const url = process.env.SCRAPER_SERVICE_URL;
  const token = process.env.SCRAPER_SERVICE_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Trader Joe\'s scraper service is not configured — set SCRAPER_SERVICE_URL and SCRAPER_SERVICE_TOKEN.',
    );
  }
  return { url: url.replace(/\/$/, ''), token };
}

/** Fetches a warm session cookie from the scraper-service, caching it
 * in-memory for COOKIE_CACHE_TTL_MS so most searches never call out.
 * Deduped so concurrent callers (a racing warm-up and a shopper's first
 * real search) share one HTTP round trip instead of each starting their
 * own. */
async function getCookieHeader(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cookieCache && Date.now() - cookieCache.fetchedAt < COOKIE_CACHE_TTL_MS) {
    return cookieCache.header;
  }

  return dedupeInFlight('trader-joes-cookie', async () => {
    if (!forceRefresh && cookieCache && Date.now() - cookieCache.fetchedAt < COOKIE_CACHE_TTL_MS) {
      return cookieCache.header;
    }

    const { url, token } = scraperServiceConfig();
    const endpoint = forceRefresh ? `${url}/trader-joes/cookie?refresh=1` : `${url}/trader-joes/cookie`;
    const res = await withTimeout(
      fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      }),
      COOKIE_FETCH_TIMEOUT_MS,
      "Trader Joe's scraper-service cookie fetch",
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`scraper-service cookie fetch failed (${res.status}): ${text.slice(0, 200)}`);
    }

    const json = (await res.json()) as { cookie?: string };
    if (!json.cookie) {
      throw new Error('scraper-service returned no cookie.');
    }

    cookieCache = { header: json.cookie, fetchedAt: Date.now() };
    return json.cookie;
  });
}

// ── Main search function ──────────────────────────────────────────────────────
export async function searchTraderJoes(
  query: string,
  zip: string,
): Promise<ApiProduct[]> {
  const storeLocation = await traderJoesLocator.findNearestStore(zip);
  if (!storeLocation?.storeId) {
    devLog(`[TraderJoes] No Trader Joe's location found near ${zip}`);
    return [];
  }
  const storeCode = storeLocation.storeId;

  const cacheKey = `${query.toLowerCase().trim()}|${storeCode}`;
  const cached = resultCache.get(cacheKey);
  if (cached) {
    devLog(`[TraderJoes] Cache hit for "${query}"`);
    return cached;
  }

  devLog(`[TraderJoes] Live fetch for "${query}" @ zip ${zip}, store ${storeCode} (${storeLocation.name})`);

  const cookieHeader = await getCookieHeader();

  try {
    const response = await fetch(TJ_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieHeader,
        Origin: 'https://www.traderjoes.com',
        Referer: 'https://www.traderjoes.com/home/products',
      },
      body: JSON.stringify({
        operationName: 'SearchProducts',
        query: SEARCH_QUERY,
        variables: {
          search: query,
          pageSize: 20,
          currentPage: 1,
          storeCode,
          availability: '1',
          published: '1',
        },
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Trader Joe's GraphQL failed (${response.status}): ${text.slice(0, 200)}`);
    }

    const json = (await response.json()) as TJSearchResponse;

    if (json.errors && json.errors.length > 0) {
      throw new Error(`Trader Joe's GraphQL errors: ${JSON.stringify(json.errors).slice(0, 200)}`);
    }

    const items = json.data?.products?.items ?? [];
    devLog(`[TraderJoes] Raw: ${items.length} items from API`);

    const products = items
      .filter(isFoodItem)
      .map(item => mapTJItem(item, storeLocation))
      .filter((p): p is ApiProduct => p !== null);

    devLog(`[TraderJoes] ${products.length} mapped products for "${query}"`);
    devLog(
      `[TraderJoes][debug] zip=${zip} -> store="${storeLocation.name}" id=${storeCode} ` +
        `address="${storeLocation.address}, ${storeLocation.city}, ${storeLocation.state} ${storeLocation.zip}" ` +
        `lat=${storeLocation.latitude ?? '?'} lng=${storeLocation.longitude ?? '?'} products=${products.length}`,
    );
    resultCache.set(cacheKey, products);
    return products;
  } catch (err) {
    throw new Error(
      `Trader Joe's scraper failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ── Timeout wrapper ───────────────────────────────────────────────────────────
export function searchTraderJoesWithTimeout(
  query: string,
  zip: string,
  timeoutMs: number,
): Promise<ApiProduct[]> {
  return withTimeout(searchTraderJoes(query, zip), timeoutMs, "Trader Joe's search");
}

// ── Warm-up ────────────────────────────────────────────────────────────────
// Primes the in-memory cookie cache from the scraper-service (instead of
// launching a browser here — Vercel never does that) at app-startup time
// instead of on the first real search. Also warms the zip-independent
// store directory (see traderJoesLocator.ts's warmDirectory) and, once a
// zip is known, the nearest-store lookup itself.
export async function warmTraderJoes(zip?: string): Promise<void> {
  await Promise.all([getCookieHeader(), warmTraderJoesDirectory()]);
  if (zip) await traderJoesLocator.findNearestStore(zip);
}
