// Minimal ESM loader so `npm test` (plain Node) can resolve the `@/*` path
// alias that Next.js/tsconfig already define for the app build. Test-only —
// does not affect `next dev`/`next build`, which resolve `@/*` themselves.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SRC_DIR = new URL('../src/', import.meta.url);

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    const base = new URL(specifier.slice(2), SRC_DIR);
    const candidates = [base.href, `${base.href}.ts`, `${base.href}/index.ts`];
    for (const candidate of candidates) {
      if (existsSync(fileURLToPath(candidate))) {
        return nextResolve(candidate, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
