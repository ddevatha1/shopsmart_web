/**
 * POST /api/planner — Smart Shopping Planner. Body items are already
 * ambiguity-resolved on the client (see plannerAmbiguityService.ts) before
 * this is ever called — this route only runs the optimizer (one
 * performSearch call per item, then a brute-force store-subset search) and
 * returns the 4 candidate plans.
 */
import { NextRequest, NextResponse } from 'next/server';
import type { PlannerListItem, ShoppingPlanRequest } from '@/types';
import { buildShoppingPlan } from '@/services/shoppingPlanOptimizer';

export const runtime = 'nodejs';
// Fans out up to 4 stores x N list items (in parallel) for search, then up
// to 15 store-subset routing calls (also in parallel) — a higher ceiling
// than /api/search's 12s since this does meaningfully more work per
// request. If the deployed platform enforces a hard cap below this, this
// route may need a paid plan tier — see DEPLOYMENT.md.
export const maxDuration = 45;

function isPlannerListItem(value: unknown): value is PlannerListItem {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.rawText === 'string';
}

export async function POST(req: NextRequest) {
  let body: Partial<ShoppingPlanRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const zipcode = body.zipcode?.trim();
  if (!zipcode || !/^\d{5}$/.test(zipcode)) {
    return NextResponse.json({ error: '`zipcode` must be a 5-digit US zip code.' }, { status: 400 });
  }

  if (!Array.isArray(body.items) || body.items.length === 0 || !body.items.every(isPlannerListItem)) {
    return NextResponse.json({ error: '`items` must be a non-empty array of resolved list items.' }, { status: 400 });
  }

  try {
    const plan = await buildShoppingPlan(body.items, zipcode);
    return NextResponse.json(plan);
  } catch (err) {
    console.warn('[Planner] plan generation failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not build a shopping plan.' },
      { status: 502 },
    );
  }
}
