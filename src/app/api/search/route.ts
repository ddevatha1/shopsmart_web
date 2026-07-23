/**
 * POST /api/search — thin NextRequest/NextResponse shell around
 * performSearch (see searchService.ts, which holds the actual pipeline and
 * is deliberately free of any `next/server` import so it — and anything
 * that calls it, like the Smart Shopping Planner's optimizer — stays
 * loadable outside the Next.js runtime, including the plain Node test
 * runner `npm test` uses).
 */
import { NextRequest, NextResponse } from 'next/server';
import { performSearch } from '@/services/searchService';

export const runtime = 'nodejs';
// Every store call inside performSearch is bounded to 8s; this is
// comfortably above the worst-case max(store timeouts) plus
// aggregation/ranking overhead, and comfortably inside Vercel's default
// function duration even on the free Hobby tier — no plan upgrade needed
// for this route.
export const maxDuration = 12;

export async function POST(req: NextRequest) {
  let body: { query?: string; zipcode?: string; noCorrect?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const rawQuery = body.query?.trim();
  const zipcode = body.zipcode?.trim();

  if (!rawQuery || !zipcode) {
    return NextResponse.json({ error: '`query` and `zipcode` are required.' }, { status: 400 });
  }

  if (!/^\d{5}$/.test(zipcode)) {
    return NextResponse.json({ error: '`zipcode` must be a 5-digit US zip code.' }, { status: 400 });
  }

  const response = await performSearch(rawQuery, zipcode, { noCorrect: body.noCorrect });
  return NextResponse.json(response);
}
