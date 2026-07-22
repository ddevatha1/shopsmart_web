/**
 * The "NavigationController" GPS feed — continuous position + compass
 * heading updates for the active Route page, separate from
 * locationService.ts's one-shot getCurrentCoordinates() (used for "how far
 * is this store" hints and the initial trip origin, which only ever need
 * a single snapshot). Web-compatible port of shopsmart_mobile's
 * liveLocationService.ts, using the browser's watchPosition instead of
 * expo-location; browsers don't expose a standalone compass API, so
 * heading comes only from GPS course-over-ground (`coords.heading`) —
 * absent while stationary, same as mobile's fallback path when no
 * magnetometer is available.
 *
 * Never fabricates a position: if permission is denied or geolocation is
 * unavailable, callers simply stop receiving updates.
 */
export interface LiveLocation {
  latitude: number;
  longitude: number;
  heading: number | null;
  accuracyMeters: number | null;
}

/**
 * Starts watching the browser's live position and invokes `onUpdate` for
 * every change. Returns an unsubscribe function that must be called when
 * the consumer unmounts.
 */
export function subscribeToLiveLocation(onUpdate: (location: LiveLocation) => void): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return () => {};
  }

  let lastHeading: number | null = null;
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const heading = position.coords.heading;
      if (heading != null && !Number.isNaN(heading) && heading >= 0) lastHeading = heading;
      onUpdate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        heading: lastHeading,
        accuracyMeters: position.coords.accuracy,
      });
    },
    () => {
      // Permission denied or unavailable — simply stop receiving updates.
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
}
