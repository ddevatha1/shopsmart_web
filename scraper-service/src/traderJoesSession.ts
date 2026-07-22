/**
 * Keeps a warm Trader Joe's session cookie ready to serve over HTTP.
 *
 * Trader Joe's GraphQL API only accepts requests once a browser session
 * (cookies) has been established against the storefront. The actual
 * per-query product search is a plain authenticated HTTP POST — only
 * *establishing* the session needs a real browser. This process is
 * long-lived (unlike a Vercel serverless function), so the cookie can
 * simply live in memory and be refreshed on an interval instead of being
 * persisted to disk and re-derived per request.
 */
import { chromium } from 'playwright';
import type { Browser, BrowserContext } from 'playwright';

const STOREFRONT_URL = 'https://www.traderjoes.com/home/products';
const REFRESH_INTERVAL_MS = 20 * 60 * 1000; // proactively refresh every 20 min
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';

interface CookieState {
  header: string;
  fetchedAt: number;
}

let cookieState: CookieState | null = null;
let inFlight: Promise<CookieState> | null = null;

async function stealthContext(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
}

async function establishSession(): Promise<CookieState> {
  console.log('[TraderJoes] Establishing a fresh session...');
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
      userAgent: DESKTOP_USER_AGENT,
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
    });
    await stealthContext(context);

    const page = await context.newPage();
    await page.goto(STOREFRONT_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.close();

    const state = await context.storageState();
    const cookies = state.cookies
      .filter((c) => c.domain.includes('traderjoes.com'))
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    if (!cookies) {
      throw new Error('Storefront visit completed but no traderjoes.com cookies were captured.');
    }

    const result: CookieState = { header: cookies, fetchedAt: Date.now() };
    cookieState = result;
    console.log('[TraderJoes] Session established.');
    return result;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

/** Returns a warm cookie header, establishing one first if none exists yet.
 * Concurrent callers share a single in-flight establishment. Pass
 * `forceRefresh` to discard a known-stale cookie and mint a new one
 * (used when the caller's own search against Trader Joe's got rejected by
 * a cookie that looked fresh here but had already been invalidated
 * upstream) — still coalesced with any already-in-flight establishment. */
export async function getCookieHeader(forceRefresh = false): Promise<string> {
  if (cookieState && !forceRefresh) return cookieState.header;

  if (!inFlight) {
    inFlight = establishSession().finally(() => {
      inFlight = null;
    });
  }
  const state = await inFlight;
  return state.header;
}

export function getSessionFetchedAt(): number | null {
  return cookieState ? cookieState.fetchedAt : null;
}

/** Call once at boot: warms the cookie immediately (rather than waiting for
 * the first request) and keeps it fresh on a timer for the life of the
 * process. */
export function startSessionRefreshLoop(): void {
  getCookieHeader().catch((err) => {
    console.error('[TraderJoes] Initial session establishment failed:', err);
  });

  setInterval(() => {
    establishSession().catch((err) => {
      console.error('[TraderJoes] Background session refresh failed (keeping last known cookie):', err);
    });
  }, REFRESH_INTERVAL_MS);
}
