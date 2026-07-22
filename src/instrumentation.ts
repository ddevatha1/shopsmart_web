/**
 * Runs once per Next.js server instance, before it starts handling any
 * requests (see https://nextjs.org/docs/app/api-reference/file-conventions/
 * instrumentation). `register()` itself IS awaited by Next before the
 * server accepts traffic, so the warm-up call below is deliberately never
 * awaited here — only the (effectively instant) decision to kick it off is
 * awaited. A slow or failed warm-up must never delay the homepage or the
 * first request the server serves; it only ever changes which request pays
 * for Kroger/Aldi/Sprouts/Trader Joe's session+token initialization.
 */
export function register() {
  // Only the Node.js runtime can run this (Playwright, `fs`, etc. aren't
  // available on the Edge runtime) — matches /api/search and /api/warmup's
  // own `export const runtime = 'nodejs'`.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    import('@/services/warmupService')
      .then(({ runWarmup }) => runWarmup())
      .catch((err) => {
        console.error('[Warmup] Unhandled error during server-boot warm-up:', err);
      });
  }
}
