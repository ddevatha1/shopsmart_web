/**
 * POST /api/warmup — called once per app-open (see GlobalOverlays.tsx /
 * warmupStore.ts) with the shopper's saved zip, if any. Runs in the
 * background from the client's perspective (fire-and-forget fetch, never
 * blocks the UI); this handler itself awaits full completion so it can
 * return real per-store timings for instrumentation, but a slow/failed
 * warm-up here has no effect on search — see warmupService.ts's doc
 * comment. Direct port of shopsmart_mobile's backend/src/routes/warmup.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { runWarmup } from '@/services/warmupService';

export const runtime = 'nodejs';
// Warming every store is now just parallel HTTP calls (Trader Joe's warm-up
// fetches a cookie from the scraper-service rather than launching a
// browser here), so this comfortably fits Vercel's free-tier limits.
export const maxDuration = 12;

export async function POST(req: NextRequest) {
  let body: { zipcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const zipcode = body.zipcode?.trim();

  if (zipcode && !/^\d{5}$/.test(zipcode)) {
    return NextResponse.json({ error: '`zipcode` must be a 5-digit US zip code.' }, { status: 400 });
  }

  const result = await runWarmup(zipcode || undefined);
  return NextResponse.json(result);
}
