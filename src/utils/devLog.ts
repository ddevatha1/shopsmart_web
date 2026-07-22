// Verbose, purely-diagnostic tracing (per-request cache hits, raw item
// counts, zip→store debug dumps) — useful while developing locally, just
// noise in production. `console.warn`/`console.error` and perfLog.ts's
// timing instrumentation are unaffected by this and always log.
export function devLog(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'production') {
    console.log(...args);
  }
}
