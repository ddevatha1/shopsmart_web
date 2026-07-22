/**
 * Tiny always-on HTTP service. Owns the two Playwright browser launches
 * ShopSmart needs (Trader Joe's session cookie, Sprouts product-image
 * fallback) so the main Next.js app, deployed to Vercel serverless
 * functions, never has to launch a browser itself. Three routes, all GET,
 * no request body — a hand-rolled router is simpler than pulling in a
 * framework for this.
 */
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { getCookieHeader, getSessionFetchedAt, startSessionRefreshLoop } from './traderJoesSession.js';
import { fetchSproutsProductImage } from './sproutsImage.js';

const PORT = Number(process.env.PORT) || 3000;
const TOKEN = process.env.SCRAPER_SERVICE_TOKEN;

if (!TOKEN) {
  console.error('[Server] SCRAPER_SERVICE_TOKEN is not set — refusing to start (every real endpoint would be unauthenticated).');
  process.exit(1);
}

function isAuthorized(authHeader: string | undefined): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const provided = Buffer.from(authHeader.slice('Bearer '.length));
  const expected = Buffer.from(TOKEN!);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}

function sendJson(res: import('node:http').ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Only GET is supported.' });
    return;
  }

  if (url.pathname === '/health') {
    const fetchedAt = getSessionFetchedAt();
    sendJson(res, 200, { ok: true, traderJoesSessionAgeMs: fetchedAt ? Date.now() - fetchedAt : null });
    return;
  }

  if (!isAuthorized(req.headers.authorization)) {
    sendJson(res, 401, { error: 'Missing or invalid Authorization header.' });
    return;
  }

  if (url.pathname === '/trader-joes/cookie') {
    try {
      const forceRefresh = url.searchParams.get('refresh') === '1';
      const cookie = await getCookieHeader(forceRefresh);
      sendJson(res, 200, { cookie, fetchedAt: getSessionFetchedAt() });
    } catch (err) {
      console.error('[Server] /trader-joes/cookie failed:', err);
      sendJson(res, 502, { error: err instanceof Error ? err.message : 'Failed to establish session.' });
    }
    return;
  }

  if (url.pathname === '/sprouts/image') {
    const productUrl = url.searchParams.get('productUrl')?.trim();
    const productName = url.searchParams.get('productName')?.trim();
    if (!productUrl || !productName) {
      sendJson(res, 400, { error: '`productUrl` and `productName` query params are required.' });
      return;
    }
    try {
      const imageUrl = await fetchSproutsProductImage(productUrl, productName);
      sendJson(res, 200, { imageUrl });
    } catch (err) {
      console.error('[Server] /sprouts/image failed:', err);
      sendJson(res, 502, { error: err instanceof Error ? err.message : 'Image fetch failed.' });
    }
    return;
  }

  sendJson(res, 404, { error: 'Not found.' });
});

server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
  startSessionRefreshLoop();
});
