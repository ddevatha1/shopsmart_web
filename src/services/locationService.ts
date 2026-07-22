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
