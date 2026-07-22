import { getCurrentCoordinates } from '@/services/locationService';
import type { StoreLocation, TripOrigin, TripPlan } from '@/types';

export class TripApiError extends Error {}

/**
 * Resolves where the trip should start (real GPS if the shopper has
 * granted permission, the ZIP-code center otherwise — never a fabricated
 * default) and hands that plus the deduplicated store stops to the
 * backend's real routing engine (POST /api/trip). Direct port of
 * shopsmart_mobile's tripService.ts, calling this app's own same-origin
 * API route instead of a separate Express server.
 */
export async function planShoppingTrip(
  stops: StoreLocation[],
  fallbackZipcode: string,
): Promise<TripPlan> {
  const coords = await getCurrentCoordinates();
  const origin: TripOrigin = coords
    ? { latitude: coords.latitude, longitude: coords.longitude }
    : { zipcode: fallbackZipcode };

  const res = await fetch('/api/trip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, stops }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new TripApiError(body?.error ?? `Server returned ${res.status}`);
  }
  return body as TripPlan;
}
