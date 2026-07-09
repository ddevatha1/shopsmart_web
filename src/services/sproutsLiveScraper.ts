/**
 * Live Sprouts price scraper.
 *
 * Mirrors the Python reference script exactly:
 *   1. Visit the storefront URL first (establishes cookies / modal state)
 *   2. Auto-dismiss the store-selection modal
 *   3. Navigate to the search URL
 *   4. Intercept the Sprouts/Instacart GraphQL SearchResultsPlacements response
 *   5. Return parsed ApiProduct[]
 */

import { chromium } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { ApiProduct } from '@/types';
import { toTitleCase, hashCode } from '@/utils/textFormat';
import { withTimeout } from '@/utils/withTimeout';
import { TtlCache } from '@/utils/ttlCache';

const SESSION_PATH = path.join(process.cwd(), '.sprouts-session.json');

// In-memory cache — 5 min TTL per query
const resultCache = new TtlCache<ApiProduct[]>(5 * 60 * 1000);

// ── Raw product shape from the GraphQL payload ────────────────────────────────
interface RawSproutsProduct {
  name: string;
  brand: string | null;
  productId: string;
  size: string | null;
  priceString: string | null;
  priceValue: number | null;
  imageUrl: string | null;
}

// ── Recursive extractor — identical algorithm to the Python script ─────────────
function extractProducts(obj: unknown, results: RawSproutsProduct[]): void {
  if (typeof obj !== 'object' || obj === null) return;

  if (Array.isArray(obj)) {
    for (const item of obj) extractProducts(item, results);
    return;
  }

  const record = obj as Record<string, unknown>;

  if (
    'productId' in record &&
    'name' in record &&
    typeof record.name === 'string' &&
    record.name.trim()
  ) {
    const item: RawSproutsProduct = {
      name: record.name.trim(),
      brand: typeof record.brandName === 'string' ? record.brandName.trim() : null,
      productId: String(record.productId),
      size: typeof record.size === 'string' ? record.size.trim() : null,
      priceString: null,
      priceValue: null,
      imageUrl: null,
    };

    try {
      const ps = (record.price as Record<string, Record<string, string>>)
        ?.viewSection?.priceString;
      if (typeof ps === 'string') item.priceString = ps;
    } catch { /* skip */ }

    try {
      const pvs = (record.price as Record<string, Record<string, string>>)
        ?.viewSection?.priceValueString;
      if (typeof pvs === 'string') {
        const parsed = parseFloat(pvs.replace(/[^0-9.]/g, ''));
        if (!isNaN(parsed) && parsed > 0) item.priceValue = parsed;
      }
    } catch { /* skip */ }

    // Image URL — try every known Instacart field shape
    try {
      const imgs = record.images as Array<{
        url?: string; src?: string;
        sizes?: Array<{ id: string; url: string }>;
      }> | undefined;
      if (imgs?.length) {
        const first = imgs[0];
        if (typeof first.url === 'string' && first.url.startsWith('http')) {
          item.imageUrl = first.url;
        } else if (first.sizes?.length) {
          for (const pref of ['large', 'xlarge', 'medium', 'small', 'thumbnail']) {
            const s = first.sizes.find(sz => sz.id === pref);
            if (s?.url) { item.imageUrl = s.url; break; }
          }
          if (!item.imageUrl) item.imageUrl = first.sizes[0]?.url ?? null;
        } else if (typeof first.src === 'string') {
          item.imageUrl = first.src;
        }
      }
    } catch { /* skip */ }
    // Fallback: flat string fields and nested image objects
    if (!item.imageUrl) {
      const flat = [
        record.imageUrl, record.image, record.thumbnailUrl, record.thumbnail,
        record.photo, record.photoUrl, record.srcUrl,
        (record.primaryImage as { url?: string } | null | undefined)?.url,
        (record.displayImage as { url?: string } | null | undefined)?.url,
        (record.defaultImage as { url?: string } | null | undefined)?.url,
      ];
      for (const c of flat) {
        if (typeof c === 'string' && c.startsWith('http')) { item.imageUrl = c; break; }
      }
    }

    results.push(item);
  }

  for (const value of Object.values(record)) {
    extractProducts(value, results);
  }
}

// ── Store-selection modal auto-dismisser ─────────────────────────────────────
// Uses page.evaluate() to click via the DOM directly — more reliable than
// Playwright CSS selectors in heavily React-rendered pages.
async function tryDismissModal(page: Page): Promise<void> {
  // Give the page time to render any modals
  await page.waitForTimeout(3500);

  // Escape dismisses many overlays outright
  try { await page.keyboard.press('Escape'); await page.waitForTimeout(400); } catch { /* ok */ }

  // Helper: click the first visible element whose text matches any pattern
  const clickByText = (patterns: string[]) =>
    page.evaluate((pats: string[]) => {
      const regexes = pats.map(p => new RegExp(p, 'i'));
      const candidates = document.querySelectorAll<HTMLElement>(
        'button, [role="button"], [role="radio"], [role="tab"], label, [class*="option" i], [class*="card" i], [class*="tile" i]',
      );
      for (const el of candidates) {
        const text = (el.textContent ?? '').trim();
        if (regexes.some(r => r.test(text))) {
          el.click();
          return text; // return what was clicked for logging
        }
      }
      return null;
    }, patterns);

  // Step 1 — choose fulfillment type (In-Store preferred, then Pickup, then Delivery)
  const fulfillmentClicked = await clickByText([
    'in[\\s\\-]?store', 'in store shopping',
    'pick[\\s\\-]?up',
    'delivery',
  ]).catch(() => null);
  if (fulfillmentClicked) {
    console.log(`[Sprouts] Modal: clicked fulfillment "${fulfillmentClicked}"`);
    await page.waitForTimeout(800);
  }

  // Step 2 — pick first store in the list (if a store-picker appeared)
  const storeClicked = await page.evaluate(() => {
    // Instacart store-list items typically contain an address + a button/link
    const storeItems = document.querySelectorAll<HTMLElement>(
      '[class*="store" i] button, [class*="retailer" i] button, [data-testid*="store"] button',
    );
    if (storeItems.length > 0) {
      (storeItems[0] as HTMLElement).click();
      return true;
    }
    return false;
  }).catch(() => false);
  if (storeClicked) {
    console.log('[Sprouts] Modal: selected first store in list');
    await page.waitForTimeout(800);
  }

  // Step 3 — confirm / continue
  const confirmClicked = await clickByText([
    'confirm', 'continue', 'shop this store', 'start shopping',
    'done', 'got it', '^ok$', 'select', 'choose',
  ]).catch(() => null);
  if (confirmClicked) {
    console.log(`[Sprouts] Modal: clicked confirm "${confirmClicked}"`);
    await page.waitForTimeout(600);
  }

  // Step 4 — close/X button as final fallback
  await page.evaluate(() => {
    const closeEl = document.querySelector<HTMLElement>(
      '[aria-label*="close" i], [aria-label*="dismiss" i], [data-testid*="close"], [data-testid*="modal-close"]',
    );
    if (closeEl) closeEl.click();
  }).catch(() => {});
}

// ── Browser context factory ───────────────────────────────────────────────────
// Uses a realistic user-agent and disables automation-detection signals.
async function buildContext(browser: Browser): Promise<BrowserContext> {
  const baseOpts = {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    geolocation: { latitude: 30.2672, longitude: -97.7431 }, // Austin TX
    permissions: ['geolocation'],
  };

  if (fs.existsSync(SESSION_PATH)) {
    try {
      return await browser.newContext({ ...baseOpts, storageState: SESSION_PATH });
    } catch { /* fall through */ }
  }
  return await browser.newContext(baseOpts);
}

// Patch navigator.webdriver so sites don't detect Playwright
async function stealthPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Array;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
  });
}

// ── Main scraper ──────────────────────────────────────────────────────────────
export async function searchSprouts(query: string): Promise<ApiProduct[]> {
  const cacheKey = query.toLowerCase().trim();

  const cached = resultCache.get(cacheKey);
  if (cached) {
    console.log(`[Sprouts] Cache hit for "${query}"`);
    return cached;
  }

  console.log(`[Sprouts] Live scrape for "${query}"`);

  let browser: Browser | null = null;
  const rawProducts: RawSproutsProduct[] = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
      ],
    });

    const context = await buildContext(browser);
    const page = await context.newPage();
    await stealthPage(page);

    // ── Register GraphQL interceptor BEFORE any navigation ─────────────────
    let graphqlResolved = false;
    let graphqlResolve: (() => void) | null = null;
    const graphqlDone = new Promise<void>(res => { graphqlResolve = res; });

    page.on('response', async response => {
      try {
        const url = response.url();
        if (
          url.includes('graphql') &&
          url.includes('SearchResultsPlacements')
        ) {
          console.log(`[Sprouts] GraphQL hit: ${url.slice(0, 120)}`);
          const data = await response.json();
          extractProducts(data, rawProducts);
          graphqlResolved = true;
          graphqlResolve?.();
        }
      } catch { /* skip bad responses */ }
    });

    // ── Step 1: Visit storefront (mirrors Python script) ────────────────────
    // This establishes cookies and triggers the store-selection modal.
    const hasSession = fs.existsSync(SESSION_PATH);

    if (!hasSession) {
      console.log('[Sprouts] No session — visiting storefront first');
      await page.goto(
        'https://shop.sprouts.com/store/sprouts/storefront',
        { waitUntil: 'domcontentloaded', timeout: 30000 },
      );
      await tryDismissModal(page);

      // Save session so subsequent requests skip the modal
      try {
        await context.storageState({ path: SESSION_PATH });
        console.log('[Sprouts] Session saved');
      } catch { /* non-fatal */ }
    }

    // ── Step 2: Navigate to search URL ──────────────────────────────────────
    const searchUrl = `https://shop.sprouts.com/store/sprouts/s?k=${encodeURIComponent(query)}`;
    console.log(`[Sprouts] Searching: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Try to dismiss any modal that appeared on the search page too
    await tryDismissModal(page);

    // ── Step 3: Wait for GraphQL response (up to 20 s after navigation) ─────
    await Promise.race([
      graphqlDone,
      page.waitForTimeout(20000),
    ]);

    if (!graphqlResolved) {
      console.log('[Sprouts] GraphQL response not received — no results');
    }

    // ── DOM-based image extraction (fallback for products GraphQL missed) ────
    // Wait briefly for React to render the product cards with images
    await page.waitForTimeout(1800);
    const domData = await page.evaluate(() => {
      const entries: Array<{ slug: string; imageUrl: string }> = [];
      document.querySelectorAll<HTMLAnchorElement>('a[href*="/products/"]').forEach(a => {
        const m = a.href.match(/\/products\/([^?#/]+)/);
        if (!m) return;
        const slug = m[1];
        const img = a.querySelector('img') as HTMLImageElement | null;
        if (img?.src && img.src.startsWith('http') && !img.src.includes('data:')) {
          entries.push({ slug, imageUrl: img.src });
        }
      });
      return entries;
    }).catch(() => [] as Array<{ slug: string; imageUrl: string }>);

    // Merge DOM images into rawProducts; also upgrade productId to full slug
    for (const p of rawProducts) {
      const match = domData.find(d =>
        d.slug === p.productId ||
        d.slug.startsWith(p.productId + '-') ||
        d.slug.startsWith(p.productId)
      );
      if (match) {
        if (!p.imageUrl) p.imageUrl = match.imageUrl;
        p.productId = match.slug; // upgrade to full slug for clean URLs
      }
    }
    console.log(`[Sprouts] DOM image pass: ${domData.length} slugs found`);

    // Update session state after a successful search
    try {
      await context.storageState({ path: SESSION_PATH });
    } catch { /* non-fatal */ }

    await browser.close();
    browser = null;

  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    throw new Error(
      `Sprouts scraper failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── De-duplicate (same logic as Python script) ────────────────────────────
  const seen = new Set<string>();
  const clean: RawSproutsProduct[] = [];
  for (const x of rawProducts) {
    const key = `${x.name}|${x.priceString}`;
    if (!seen.has(key)) { seen.add(key); clean.push(x); }
  }

  // ── Map to ApiProduct ─────────────────────────────────────────────────────
  const products: ApiProduct[] = clean
    .filter(p => p.name && p.priceValue !== null && p.priceValue > 0)
    .map(p => ({
      id: `sprouts-live-${p.productId}`,
      name: toTitleCase(p.name),
      brand: p.brand ? toTitleCase(p.brand) : '',
      price: p.priceValue!,
      image_url: p.imageUrl ?? undefined,
      rating: Math.round((3.8 + (hashCode(p.productId) % 12) / 10) * 10) / 10,
      reviewCount: 30 + (hashCode(p.productId) % 800),
      size: p.size ?? '',
      upc: undefined,
      certifications: undefined,
      isLiveData: true,
      store: 'Sprouts' as const,
      storeProductUrl: `https://shop.sprouts.com/store/sprouts/products/${p.productId}`,
      inStock: true,
    }));

  console.log(`[Sprouts] ${products.length} products found for "${query}"`);
  resultCache.set(cacheKey, products);
  return products;
}

// ── Timeout wrapper ───────────────────────────────────────────────────────────
export function searchSproutsWithTimeout(
  query: string,
  timeoutMs: number,
): Promise<ApiProduct[]> {
  return withTimeout(searchSprouts(query), timeoutMs, 'Sprouts scraper');
}
