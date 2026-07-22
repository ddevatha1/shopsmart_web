'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { StoreName, TripPlan } from '@/types';
import type { StopProgress } from '@/services/navigationController';
import type { LiveLocation } from '@/services/liveLocationService';
import type { NavigationMode } from '@/store/routeStore';
import { storeAccents } from '@/theme/colors';

interface Props {
  trip: TripPlan;
  /** Store chain per stop, same order as `trip.stops` — used only to color
   * each marker consistently with that store's accent color elsewhere in
   * the app. */
  stopStores: StoreName[];
  stopProgress: StopProgress[];
  /** Index of the current destination — trip.stops.length once every stop
   * is done. */
  activeStopIndex: number;
  liveLocation: LiveLocation | null;
  followMode: boolean;
  /** Trip Overview (flat, whole-trip bounds-fit) vs Navigation Mode
   * (zoomed/pitched/rotated, camera follows the live position). */
  mode: NavigationMode;
  onManualPan: () => void;
  onRecenter: () => void;
  /** Non-positioning layout classes only (e.g. "h-[340px] w-full") — sizing
   * classes are safe to pass here since they don't collide with anything
   * MapLibre's own stylesheet sets. Positioning is handled separately via
   * `fill`, deliberately never through a Tailwind position utility class —
   * see the `fill` doc below for why. */
  className?: string;
  /** false (default): a normal in-flow block, sized by `className`
   * (Trip Overview's fixed-height map). true: absolutely fills its
   * parent (Navigation Mode's flex-1 map). Always applied as an inline
   * style, never as a Tailwind `relative`/`absolute` class — maplibre-gl's
   * own stylesheet ships a same-specificity `.maplibregl-map { position:
   * relative }` rule that, depending on CSS import order, can silently
   * override a class-based position utility on this exact element and
   * collapse it (and, when `fill` is true, its absolutely-positioned
   * child in turn loses its containing block and collapses too). An
   * inline style always wins regardless of import order. */
  fill?: boolean;
}

const OVERVIEW_PITCH = 0;
const NAV_ZOOM = 17.5;
const NAV_PITCH = 55;

interface MarkerSpec {
  lat: number | undefined;
  lng: number | undefined;
  label: string;
  color: string;
  name: string;
  address: string;
  state: 'completed' | 'active' | 'upcoming';
}

const CIRCLED_DIGITS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
function stopLabel(index: number): string {
  return CIRCLED_DIGITS[index] ?? String(index + 1);
}

function stopPinSvg(color: string, label: string): string {
  return `<svg width="34" height="44" viewBox="0 0 34 44" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 0C7.6 0 0 7.6 0 17c0 12.4 17 27 17 27s17-14.6 17-27C34 7.6 26.4 0 17 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <circle cx="17" cy="16" r="10.5" fill="#fff"/>
    <text x="17" y="21" text-anchor="middle" font-family="-apple-system,sans-serif" font-weight="700" font-size="13" fill="${color}">${label}</text>
  </svg>`;
}

function userArrowSvg(): string {
  return `<svg width="34" height="34" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M17 2 L29 29 L17 22 L5 29 Z" fill="#2563EB" stroke="#fff" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

/** Great-circle bearing from `from` to `to` ([lng,lat] pairs, degrees). */
function bearingToward(from: [number, number], to: [number, number]): number {
  const lat1 = (from[1] * Math.PI) / 180;
  const lat2 = (to[1] * Math.PI) / 180;
  const dLon = ((to[0] - from[0]) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function nearestForwardIndex(
  coordinates: [number, number][],
  target: { latitude?: number; longitude?: number },
  fromIdx: number,
): number | null {
  if (target.latitude == null || target.longitude == null) return null;
  let bestIdx = fromIdx;
  let bestDist = Infinity;
  for (let i = fromIdx; i < coordinates.length; i++) {
    const [lng, lat] = coordinates[i];
    const d = (lat - target.latitude) ** 2 + (lng - target.longitude) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function computeInitialSplitIndex(coordinates: [number, number][], trip: TripPlan, activeStopIndex: number): number {
  if (activeStopIndex <= 0 || coordinates.length === 0) return 0;
  let searchFrom = 0;
  let lastIdx = 0;
  for (let i = 0; i < Math.min(activeStopIndex, trip.stops.length); i++) {
    const idx = nearestForwardIndex(coordinates, trip.stops[i].location, searchFrom);
    if (idx != null) {
      lastIdx = idx;
      searchFrom = idx;
    }
  }
  return lastIdx;
}

/**
 * The "MapRenderer" — real vector map tiles (OpenFreeMap's "liberty"
 * style) via MapLibre GL JS, running natively in the browser DOM instead
 * of mobile's WebView-wrapped equivalent (actually simpler here — no
 * postMessage bridge needed, since this component and the map's own event
 * handlers already share one JS runtime). Direct port of
 * shopsmart_mobile's RouteMap.tsx: same marker pins, same
 * traveled/remaining route split, same overview↔navigation camera
 * transitions — the map is built once per trip and every subsequent
 * update (GPS ticks, checklist changes, mode switches) mutates it in
 * place rather than rebuilding.
 */
export default function RouteMap({
  trip, stopStores, stopProgress, activeStopIndex, liveLocation, followMode, mode, onManualPan, onRecenter, className, fill,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const stopMarkersRef = useRef<({ marker: maplibregl.Marker; el: HTMLElement; data: MarkerSpec } | null)[]>([]);
  const lastUserLocRef = useRef<[number, number] | null>(null);
  const lastHeadingRef = useRef<number | null>(null);
  const splitIdxRef = useRef(0);
  const navModeRef = useRef(false);
  const readyRef = useRef(false);

  const [ready, setReady] = useState(false);

  // Captured once at mount, purely to seed the initial marker states and
  // the initial (pre-GPS) route split — deliberately NOT re-derived from
  // live props on every render; every state change after mount goes
  // through the imperative effects below instead of a rebuild.
  const [initialStopProgress] = useState(() => stopProgress);
  const [initialActiveStopIndex] = useState(() => activeStopIndex);

  useEffect(() => {
    if (!containerRef.current) return;

    const routeCoords = trip.routeGeometry.coordinates;
    const initialSplitIdx = computeInitialSplitIndex(routeCoords, trip, initialActiveStopIndex);
    splitIdxRef.current = initialSplitIdx;

    const markers: MarkerSpec[] = trip.stops.map((stop, i) => ({
      lat: stop.location.latitude,
      lng: stop.location.longitude,
      label: stopLabel(i),
      color: storeAccents[stopStores[i]]?.dot ?? '#2C742F',
      name: stop.location.name,
      address: `${stop.location.address}, ${stop.location.city}, ${stop.location.state} ${stop.location.zip}`,
      state: initialStopProgress[i]?.isComplete ? 'completed' : i === initialActiveStopIndex ? 'active' : 'upcoming',
    }));

    const bounds: [number, number][] = [
      [trip.origin.longitude, trip.origin.latitude],
      ...markers
        .filter((m): m is MarkerSpec & { lat: number; lng: number } => m.lat != null && m.lng != null)
        .map((m): [number, number] => [m.lng, m.lat]),
    ];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [trip.origin.longitude, trip.origin.latitude],
      zoom: 12,
      pitch: OVERVIEW_PITCH,
      attributionControl: false,
      maxPitch: 60,
    });
    mapRef.current = map;

    // The container's size changes after mount (Overview's fixed-height
    // map div lays out asynchronously relative to the rest of the page,
    // and Navigation Mode's flex-1 map div resizes again on the
    // overview/navigation transition) — MapLibre only ever measures its
    // container once, at construction, so without this the canvas stays
    // whatever size it was on the very first paint and everything below
    // that renders blank.
    const resizeObserver = new ResizeObserver(() => {
      // The observer's very first callback can fire before the style has
      // finished its initial load (a ResizeObserver dispatches once as
      // soon as observation starts, regardless of map readiness) — calling
      // resize() that early throws "Style is not done loading" from
      // inside MapLibre itself.
      if (readyRef.current) map.resize();
    });
    resizeObserver.observe(containerRef.current);

    function fitOverviewBounds(extra: [number, number] | null) {
      const all = extra ? [...bounds, extra] : bounds;
      if (all.length === 0) return;
      const b = all.reduce((acc, c) => acc.extend(c), new maplibregl.LngLatBounds(all[0], all[0]));
      map.fitBounds(b, { padding: { top: 70, bottom: 70, left: 44, right: 44 }, duration: navModeRef.current ? 0 : 1000, maxZoom: 16 });
    }

    map.on('load', () => {
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      markers.forEach((m) => {
        if (m.lat == null || m.lng == null) {
          stopMarkersRef.current.push(null);
          return;
        }
        const wrap = document.createElement('div');
        wrap.style.position = 'relative';
        wrap.style.width = '34px';
        wrap.style.height = '44px';

        const ring = document.createElement('div');
        ring.style.cssText = `position:absolute;width:34px;height:34px;border-radius:17px;top:0;left:0;background:${m.color};opacity:0.35;display:none;`;
        ring.className = 'shopsmart-pulse-ring';

        const svgHost = document.createElement('div');
        svgHost.style.cssText = 'width:34px;height:44px;transition:opacity 0.3s ease;';
        const color = m.state === 'completed' ? '#9CA3AF' : m.color;
        const label = m.state === 'completed' ? '✓' : m.label;
        svgHost.innerHTML = stopPinSvg(color, label);
        svgHost.style.opacity = m.state === 'completed' ? '0.5' : '1';
        ring.style.display = m.state === 'active' ? 'block' : 'none';

        wrap.appendChild(ring);
        wrap.appendChild(svgHost);

        const marker = new maplibregl.Marker({ element: wrap, anchor: 'bottom' })
          .setLngLat([m.lng, m.lat])
          .setPopup(new maplibregl.Popup({ offset: 38 }).setHTML(`<b>${m.name}</b><br/>${m.address}`))
          .addTo(map);
        stopMarkersRef.current.push({ marker, el: wrap, data: { ...m } });
      });

      const traveled = routeCoords.slice(0, initialSplitIdx + 1);
      const remaining = routeCoords.slice(initialSplitIdx);

      map.addSource('route-traveled', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: traveled }, properties: {} } });
      map.addLayer({ id: 'route-traveled', type: 'line', source: 'route-traveled', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#9CA3AF', 'line-width': 4, 'line-opacity': 0.7 } });
      map.setLayoutProperty('route-traveled', 'visibility', 'none');

      map.addSource('route-remaining', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: remaining }, properties: {} } });
      map.addLayer({ id: 'route-remaining', type: 'line', source: 'route-remaining', layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': '#2C742F', 'line-width': 5, 'line-opacity': 0.9 } });

      const originEl = document.createElement('div');
      originEl.style.cssText = 'width:16px;height:16px;border-radius:8px;background:#6B7280;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.35);';
      originMarkerRef.current = new maplibregl.Marker({ element: originEl, anchor: 'center' })
        .setLngLat([trip.origin.longitude, trip.origin.latitude])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setText('Trip start'))
        .addTo(map);

      fitOverviewBounds(null);

      map.on('dragstart', (e) => {
        if (e.originalEvent) onManualPan();
      });

      readyRef.current = true;
      setReady(true);
    });

    return () => {
      readyRef.current = false;
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      stopMarkersRef.current = [];
      userMarkerRef.current = null;
      originMarkerRef.current = null;
      setReady(false);
    };
    // Built once per trip — every subsequent update goes through the
    // effects below, not a rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip, stopStores]);

  function resolveBearing(fromLngLat: [number, number]): number {
    if (lastHeadingRef.current != null) return lastHeadingRef.current;
    const active = stopMarkersRef.current.find(m => m?.data.state === 'active');
    if (active?.data.lat != null && active.data.lng != null) {
      return bearingToward(fromLngLat, [active.data.lng, active.data.lat]);
    }
    return mapRef.current?.getBearing() ?? 0;
  }

  function setRouteData(traveled: [number, number][], remaining: [number, number][]) {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource('route-traveled') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'Feature', geometry: { type: 'LineString', coordinates: traveled }, properties: {},
    });
    (map.getSource('route-remaining') as maplibregl.GeoJSONSource | undefined)?.setData({
      type: 'Feature', geometry: { type: 'LineString', coordinates: remaining }, properties: {},
    });
  }

  // Live location → move/rotate the marker, keep the traveled/remaining
  // split anchored to the shopper's real position while navigating, and
  // (if following) recenter/re-orient the camera.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !liveLocation) return;
    lastUserLocRef.current = [liveLocation.longitude, liveLocation.latitude];
    if (liveLocation.heading != null) lastHeadingRef.current = liveLocation.heading;
    const bearing = resolveBearing(lastUserLocRef.current);

    if (!userMarkerRef.current) {
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      const wrap = document.createElement('div');
      wrap.style.cssText = 'width:46px;height:46px;display:flex;align-items:center;justify-content:center;transition:transform 0.5s linear;';
      const halo = document.createElement('div');
      halo.style.cssText = 'position:absolute;width:46px;height:46px;border-radius:23px;background:rgba(37,99,235,0.16);';
      const arrowHost = document.createElement('div');
      arrowHost.style.cssText = 'width:34px;height:34px;';
      arrowHost.innerHTML = userArrowSvg();
      wrap.appendChild(halo);
      wrap.appendChild(arrowHost);
      userMarkerRef.current = new maplibregl.Marker({ element: wrap, anchor: 'center', rotationAlignment: 'map' })
        .setLngLat(lastUserLocRef.current)
        .addTo(map);
      if (!navModeRef.current) {
        map.easeTo({ center: lastUserLocRef.current, duration: 400 });
      }
    } else {
      userMarkerRef.current.setLngLat(lastUserLocRef.current);
    }
    userMarkerRef.current.setRotation(bearing);

    if (navModeRef.current) {
      const routeCoords = trip.routeGeometry.coordinates;
      splitIdxRef.current = nearestForwardIndex(
        routeCoords,
        { latitude: liveLocation.latitude, longitude: liveLocation.longitude },
        splitIdxRef.current,
      ) ?? splitIdxRef.current;
      setRouteData(routeCoords.slice(0, splitIdxRef.current + 1), routeCoords.slice(splitIdxRef.current));
    }

    if (followMode) {
      if (navModeRef.current) {
        map.easeTo({ center: lastUserLocRef.current, zoom: NAV_ZOOM, pitch: NAV_PITCH, bearing, duration: 500 });
      } else {
        map.easeTo({ center: lastUserLocRef.current, duration: 400 });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveLocation, ready]);

  // Follow-mode toggling alone (e.g. tapping "recenter") still needs to
  // re-center on the last known position.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !followMode || !lastUserLocRef.current) return;
    const bearing = resolveBearing(lastUserLocRef.current);
    if (navModeRef.current) {
      map.easeTo({ center: lastUserLocRef.current, zoom: NAV_ZOOM, pitch: NAV_PITCH, bearing, duration: 500 });
    } else {
      map.easeTo({ center: lastUserLocRef.current, duration: 400 });
    }
  }, [followMode, ready]);

  // Overview ↔ Navigation — a camera transition, never a rebuild.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    navModeRef.current = mode === 'navigation';
    if (mode === 'navigation') {
      map.setLayoutProperty('route-traveled', 'visibility', 'visible');
      const center = lastUserLocRef.current ?? [trip.origin.longitude, trip.origin.latitude] as [number, number];
      map.easeTo({ center, zoom: NAV_ZOOM, pitch: NAV_PITCH, bearing: resolveBearing(center), duration: 1200 });
    } else {
      map.setLayoutProperty('route-traveled', 'visibility', 'none');
      map.easeTo({ pitch: OVERVIEW_PITCH, bearing: 0, duration: 700 });
    }
    // trip is a stable prop for the component's whole lifetime (a new trip
    // remounts this component via a `key` change one level up), so reading
    // trip.origin here doesn't need to be a re-run trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, ready]);

  // Stop-marker visuals (upcoming/active/completed) update in place — a
  // checklist toggle should never cost a full map reload.
  useEffect(() => {
    if (!ready) return;
    const states = trip.stops.map((_, i) =>
      stopProgress[i]?.isComplete ? 'completed' as const : i === activeStopIndex ? 'active' as const : 'upcoming' as const,
    );
    states.forEach((state, i) => {
      const ref = stopMarkersRef.current[i];
      if (!ref || ref.data.state === state) return;
      ref.data.state = state;
      const svgHost = ref.el.children[1] as HTMLElement;
      const ring = ref.el.children[0] as HTMLElement;
      const color = state === 'completed' ? '#9CA3AF' : ref.data.color;
      const label = state === 'completed' ? '✓' : ref.data.label;
      svgHost.innerHTML = stopPinSvg(color, label);
      svgHost.style.opacity = state === 'completed' ? '0.5' : '1';
      ring.style.display = state === 'active' ? 'block' : 'none';
    });
  }, [trip, stopProgress, activeStopIndex, ready]);

  return (
    <div
      className={`overflow-hidden bg-gray-200 ${className ?? ''}`}
      style={fill ? { position: 'absolute', inset: 0 } : { position: 'relative' }}
    >
      {/* Inline style, not a Tailwind class — maplibre-gl.css ships its own
          `.maplibregl-map { position: relative }` rule with equal
          specificity to Tailwind's `.absolute`, and depending on stylesheet
          import order that class rule can silently win, collapsing this
          container (and the canvas MapLibre sizes from it) down to its
          content height. An inline style always wins regardless of import
          order, so the map reliably fills its parent. */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {!followMode && (
        <button
          type="button"
          onClick={onRecenter}
          className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors z-10"
          aria-label="Recenter map"
        >
          <svg className="w-[18px] h-[18px] text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}
