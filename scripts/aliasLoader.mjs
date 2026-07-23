// Minimal ESM loader so `npm test` (plain Node) can resolve the `@/*` path
// alias that Next.js/tsconfig already define for the app build. Test-only —
// does not affect `next dev`/`next build`, which resolve `@/*` themselves.
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC_DIR = new URL('../src/', import.meta.url);

// existsSync alone isn't enough: for a barrel like `@/types` (a directory
// containing index.ts), the bare candidate `src/types` itself "exists" as
// a directory, so an existence-only check picks it and Node's ESM resolver
// then rejects it (directories aren't importable). Only a real file counts
// as a match; `.ts`/`/index.ts` are tried before the bare path for exactly
// this reason.
function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = new URL(specifier.slice(2), SRC_DIR);
    const candidates = [`${base.href}.ts`, `${base.href}/index.ts`, base.href];
    for (const candidate of candidates) {
      if (isFile(candidate)) {
        return nextResolve(candidate, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
