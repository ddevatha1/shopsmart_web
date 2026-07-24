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

// Caps how long any caller of getCurrentCoordinates() will actually wait —
// a shopper who leaves the browser's permission prompt unanswered (neither
// Allow nor Block) can otherwise leave getCurrentPosition's own `timeout`
// pending indefinitely: that option only bounds how long the browser waits
// for a *position fix once permission is settled*, not how long the
// permission prompt itself is left unanswered, so a shopper who simply
// never responds to it can hang this promise forever (found live: it
// blocked Search from ever firing its request). Racing the whole flow
// against this timeout is what actually makes the "never blocks the UI"
// contract in this file's own header comment true, rather than just
// documented intent.
const PERMISSION_TIMEOUT_MS = 4000;

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      () => { clearTimeout(timer); resolve(fallback); },
    );
  });
}

function resolveCoordinates(): Promise<Coordinates | null> {
  return new Promise((resolve) => {
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
}

export async function getCurrentCoordinates(): Promise<Coordinates | null> {
  if (cached && Date.now() < cached.expiresAt) return cached.coords;

  // `undefined` (distinct from a settled `null`) means the permission
  // prompt never resolved within the timeout — treated as "check again
  // next time" rather than cached as a 5-minute "no location," since it
  // was never actually answered.
  const result = await withTimeout<Coordinates | null | undefined>(
    resolveCoordinates(),
    PERMISSION_TIMEOUT_MS,
    undefined,
  );

  if (result !== undefined) {
    cached = { coords: result, expiresAt: Date.now() + CACHE_TTL_MS };
  }
  return result ?? null;
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
