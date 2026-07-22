/**
 * GET /api/product-image?name=...&store=...&storeProductUrl=... —
 * server-side fallback photo lookup for products a store's own listing
 * didn't include an image for (after /api/search's free, exact same-response
 * sibling backfill has already had a chance — see backfillImagesFromSiblings
 * in the search route — this only runs for whatever is still missing after
 * that). Ported from shopsmart_mobile's backend/src/routes/productImage.ts.
 *
 * Two tiers, tried in order:
 *
 *  1. Same-site product-page scrape — when `store`/`storeProductUrl` are
 *     given and a scraper for that store is registered (Sprouts today —
 *     it's where this app's missing-image cases actually come from), visit
 *     that exact product's own page and read the photo it shows there.
 *     This is the same site the app already scrapes for its core search
 *     feature — not a new site or a generic image search — and it's an
 *     exact lookup (a known URL for a known product), not a fuzzy one, so
 *     when it succeeds it's about as reliable as a fallback gets.
 *  2. Open Food Facts (world.openfoodfacts.org) — free, no API key, an
 *     open collaborative grocery product database (ODbL-licensed
 *     specifically for reuse like this). Their API requires a descriptive
 *     User-Agent identifying the calling app; omitting one gets requests
 *     silently rejected. Every candidate is checked with
 *     hasDifferentHeadNoun — the same structural "is this actually the
 *     same product" signal the search route uses for relevance/
 *     classification — before its image is trusted. This is what turns
 *     "first result with any image" into "a result that's actually the
 *     same product, or nothing."
 */
import { NextRequest, NextResponse } from 'next/server';
import { hasDifferentHeadNoun, tokenizeName } from '@/app/api/search/route';
import { fetchSproutsProductImage } from '@/services/sproutsLiveScraper';
import { TtlCache } from '@/utils/ttlCache';
import { withTimeout } from '@/utils/withTimeout';

export const runtime = 'nodejs';

// Product photos essentially never change, so this is really "cache
// forever, but bounded so the process doesn't grow unboundedly across a
// long-lived deploy" — 30 days comfortably outlives most deploy cycles.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const imageCache = new TtlCache<string | null>(CACHE_TTL_MS);

// Registry of per-store product-page scrapers — only Sprouts today,
// because that's the only store this app has actually observed missing
// images from (Kroger/Aldi's official APIs and Trader Joe's listings
// reliably include one). Adding another store later is a one-line entry
// here, not a new endpoint.
const STORE_IMAGE_SCRAPERS: Record<string, (url: string, name: string) => Promise<string | null>> = {
  Sprouts: fetchSproutsProductImage,
};

const USER_AGENT = 'ShopSmartWeb/1.0 (grocery price comparison app)';
const FETCH_TIMEOUT_MS = 5000;

interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  image_front_url?: string;
  image_url?: string;
}

interface OpenFoodFactsResponse {
  products?: OpenFoodFactsProduct[];
}

async function lookupOpenFoodFacts(productName: string): Promise<string | null> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(productName)}&search_simple=1&action=process&json=1&page_size=8`;

  const res = await withTimeout(
    fetch(url, { headers: { 'User-Agent': USER_AGENT } }),
    FETCH_TIMEOUT_MS,
    'Open Food Facts',
  );
  if (!res.ok) throw new Error(`Open Food Facts returned ${res.status}`);

  const data = (await res.json()) as OpenFoodFactsResponse;
  const queryWords = tokenizeName(productName);

  for (const product of data.products ?? []) {
    const imageUrl = product.image_front_url || product.image_url;
    if (!imageUrl) continue;

    const candidateName = [product.brands, product.product_name].filter(Boolean).join(' ');
    const candidateWords = tokenizeName(candidateName);
    if (candidateWords.length === 0) continue;

    // Reject anything that reads as a different product from our name's
    // perspective (wrong flavor base, wrong product type entirely, ...).
    if (hasDifferentHeadNoun(queryWords, candidateWords)) continue;

    return imageUrl;
  }

  return null;
}

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim() ?? '';
  if (!name) {
    return NextResponse.json({ error: '`name` query parameter is required.' }, { status: 400 });
  }
  const store = req.nextUrl.searchParams.get('store')?.trim() ?? '';
  const storeProductUrl = req.nextUrl.searchParams.get('storeProductUrl')?.trim() ?? '';

  // The store-page scrape is keyed by URL (it's an exact lookup, not a
  // fuzzy name search), so two differently-named products at the same URL
  // — or the same product reached via different query text — don't collide
  // with each other or with the plain name-only OFF cache entries below.
  const cacheKey = storeProductUrl ? `url:${storeProductUrl}` : name.toLowerCase();
  const cached = imageCache.get(cacheKey);
  if (cached !== undefined) {
    return NextResponse.json({ imageUrl: cached });
  }

  const storeScraper = store ? STORE_IMAGE_SCRAPERS[store] : undefined;
  if (storeScraper && storeProductUrl) {
    try {
      const scraped = await storeScraper(storeProductUrl, name);
      if (scraped) {
        imageCache.set(cacheKey, scraped);
        return NextResponse.json({ imageUrl: scraped });
      }
    } catch (err) {
      console.warn('[ProductImage] store scrape failed:', err);
    }
  }

  let imageUrl: string | null;
  try {
    imageUrl = await lookupOpenFoodFacts(name);
  } catch (err) {
    console.warn('[ProductImage] lookup failed:', err);
    // A transient failure isn't cached as a permanent "no match" — only a
    // completed lookup (found or genuinely not found) is.
    return NextResponse.json({ imageUrl: null });
  }

  imageCache.set(cacheKey, imageUrl);
  return NextResponse.json({ imageUrl });
}
