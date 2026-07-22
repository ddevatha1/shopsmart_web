// Lightweight timestamped instrumentation for comparing first-search
// latency before vs. after warm-up — every line is prefixed `[Perf]` so
// it's trivially greppable out of the rest of the app's logs. `+Nms` is
// elapsed time since this module first loaded — on the server that's
// process boot (module load happens at server start/first import); in the
// browser that's app open (module load happens on page load) — the same
// reference point every event in a given process/session shares, so
// "warmup:start" vs "first-search:start" deltas are directly comparable.
// Isomorphic: safe to import from both server (route handlers,
// instrumentation.ts) and client (React components) code.
const start = Date.now();

export function perfLog(event: string, meta?: Record<string, unknown>): void {
  const elapsedMs = Date.now() - start;
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[Perf] ${event} +${elapsedMs}ms${suffix}`);
}
