/** POST /api/trip — ported from shopsmart_mobile's backend/src/routes/trip.ts. */
import { NextRequest, NextResponse } from 'next/server';
import type { StoreLocation, TripOrigin, TripRequest } from '@/types';
import { planTrip } from '@/services/tripPlanner';

export const runtime = 'nodejs';

function isStoreLocation(value: unknown): value is StoreLocation {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.name === 'string' &&
    typeof v.address === 'string' &&
    typeof v.city === 'string' &&
    typeof v.state === 'string' &&
    typeof v.zip === 'string'
  );
}

export async function POST(req: NextRequest) {
  let body: Partial<TripRequest>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const origin = body.origin as TripOrigin | undefined;
  const hasCoords = origin?.latitude != null && origin?.longitude != null;
  const hasZip = !!origin?.zipcode;
  if (!origin || (!hasCoords && !hasZip)) {
    return NextResponse.json({ error: '`origin` must include latitude/longitude or a zipcode.' }, { status: 400 });
  }

  if (!Array.isArray(body.stops) || body.stops.length === 0 || !body.stops.every(isStoreLocation)) {
    return NextResponse.json(
      { error: '`stops` must be a non-empty array of StoreLocation objects.' },
      { status: 400 },
    );
  }

  try {
    const plan = await planTrip(origin, body.stops);
    return NextResponse.json(plan);
  } catch (err) {
    console.warn('[Trip] planning failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Route planning failed.' },
      { status: 502 },
    );
  }
}
