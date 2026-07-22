/**
 * The single place this app asks for the browser's real GPS position —
 * used both for a "how far is this store" hint on the product detail page
 * and as the starting point for route planning. Web-compatible replacement
 * for shopsmart_mobile's locationService.ts, which uses `expo-location`;
 * this uses the standard browser Geolocation API instead, but keeps the
 * exact same interface (`Coordinates`, `getCurrentCoordinates()`, 5-minute
 * cache) so every caller ported from mobile needs no changes.
 *
 * Never blocks the UI waiting on a permission prompt the user might
 * dismiss: every caller treats `null` (permission denied, geolocation
 * unavailable, not running in a browser, or a genuine error) as "no
 * coordinates available" and falls back to the shopper's saved ZIP
 * instead, exactly the way the rest of the app already treats optional
 * location data.
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface PreciseLocationResult {
  coords: Coordinates;
  /** The browser's own radius-of-confidence for this fix, in meters —
   * surfaced so the caller (the route-planning "share your exact location"
   * prompt) can show the shopper how precise the fix it just got actually
   * was, rather than a bare "done." */
  accuracyMeters: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cached: { coords: Coordinates | null; expiresAt: number } | null = null;

export async function getCurrentCoordinates(): Promise<Coordinates | null> {
  if (cached && Date.now() < cached.expiresAt) return cached.coords;

  const coords = await new Promise<Coordinates | null>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: CACHE_TTL_MS },
    );
  });

  cached = { coords, expiresAt: Date.now() + CACHE_TTL_MS };
  return coords;
}

/** A shopper-initiated, high-accuracy GPS fix — used only by the pre-route
 * "share your exact location" prompt, where a shopper has explicitly asked
 * for the most accurate starting point available for driving directions,
 * rather than the quick/low-power fix `getCurrentCoordinates` normally
 * settles for. Always bypasses the cache and requests a fresh fix
 * (`maximumAge: 0`), unlike `getCurrentCoordinates`. A successful result
 * also refreshes the shared cache, so every other caller (product-detail
 * distance, closest-store sorting) benefits from the more precise fix for
 * the rest of its TTL too. */
export async function requestPreciseLocation(): Promise<PreciseLocationResult | null> {
  const result = await new Promise<PreciseLocationResult | null>((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
        accuracyMeters: position.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  });

  cached = { coords: result?.coords ?? null, expiresAt: Date.now() + CACHE_TTL_MS };
  return result;
}
