/**
 * Single-product image fetch for Sprouts — used as an image-fallback tier
 * when a Sprouts listing came back from search without an image_url. Visits
 * that exact product's own page (already known via storeProductUrl — no
 * search needed) and reads whatever photo Sprouts' own site shows for it.
 *
 * Ported unchanged from the main app's src/services/sproutsLiveScraper.ts —
 * this was already the one place that scraper needed a real browser for a
 * single, self-contained, exact lookup (not a search), so it moved here
 * as-is rather than being reworked.
 */
import { chromium } from 'playwright';
import type { Browser } from 'playwright';

export async function fetchSproutsProductImage(
  productUrl: string,
  productName: string,
): Promise<string | null> {
  let browser: Browser | null = null;
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

    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2500);

    // Every real product photo on Sprouts' site carries an `alt` equal to
    // the product name — the same signal the main scraper's DOM pass used
    // to match on, just here compared directly to the name we already have
    // instead of a URL slug. Tracking pixels/icons have no alt text and
    // are filtered out by the size check.
    const imageUrl = await page.evaluate((name: string) => {
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const targetWords = normalize(name).split(' ').filter(Boolean);
      if (targetWords.length === 0) return null;

      let best: { src: string; score: number } | null = null;
      for (const img of Array.from(document.querySelectorAll('img'))) {
        const src = img.currentSrc || img.src;
        if (!src || !src.startsWith('http') || src.includes('data:')) continue;
        if (img.naturalWidth < 200 || img.naturalHeight < 200) continue;
        const altWords = new Set(normalize(img.alt || '').split(' ').filter(Boolean));
        if (altWords.size === 0) continue;
        const matched = targetWords.filter((w) => altWords.has(w)).length;
        const score = matched / targetWords.length;
        if (score > (best?.score ?? 0)) best = { src, score };
      }
      // Require near-complete word overlap — this is a same-site, exact
      // lookup (not a fuzzy third-party search), so a weak match here
      // means something's wrong rather than "close enough."
      return best && best.score >= 0.8 ? best.src : null;
    }, productName);

    return imageUrl;
  } catch (err) {
    console.warn('[Sprouts] product-image fetch failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}
