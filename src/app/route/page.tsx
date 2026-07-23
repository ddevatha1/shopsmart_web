'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useSearchStore } from '@/store/searchStore';
import { useUserStore } from '@/store/userStore';
import { useRouteStore } from '@/store/routeStore';
import { groupCartByStore, locationKey } from '@/utils/groupCartByStore';
import { planShoppingTrip } from '@/services/tripService';
import { requestPreciseLocation } from '@/services/locationService';
import { subscribeToLiveLocation, type LiveLocation } from '@/services/liveLocationService';
import LocationPermissionModal from '@/components/route/LocationPermissionModal';
import {
  computeStopProgress,
  computeTripProgress,
  computeTripSignature,
  type StopProgress,
  type TripProgress,
} from '@/services/navigationController';
import { recordPurchases } from '@/services/purchaseHistoryService';
import AppHeader from '@/components/AppHeader';
import RouteMap from '@/components/RouteMap';
import { ContextualHint } from '@/components/onboarding/ContextualHint';
import { storeAccents } from '@/theme/colors';
import type { CartItem, StoreGroup, StoreName, TripPlan } from '@/types';

// One explainer per browser session, not once per visit to /route — a
// shopper who already said yes (or explicitly skipped) shouldn't be asked
// again just for navigating back to the cart and returning here. Resets on
// a new tab/session, which also gives someone who skipped a natural chance
// to reconsider without needing a settings screen for it.
const LOCATION_PROMPT_SESSION_KEY = 'shopsmart:routeLocationPromptSeen';

function hasSeenLocationPrompt(): boolean {
  if (typeof window === 'undefined') return true;
  return sessionStorage.getItem(LOCATION_PROMPT_SESSION_KEY) === '1';
}

function formatDuration(minutes: number): string {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/**
 * The Route page — orchestrates groupCartByStore (store selection),
 * tripService (the real routing call), navigationController (all derived
 * progress state), routeStore (checklist persistence + follow-mode), and
 * liveLocationService (browser GPS), plus RouteMap for rendering. Direct
 * port of shopsmart_mobile's RouteScreen, as a real routed page
 * (`/route`) per this port's page-architecture decision.
 */
export default function RoutePage() {
  const router = useRouter();
  const items = useCartStore(s => s.items);
  const activeZip = useSearchStore(s => s.activeZip);
  const user = useUserStore(s => s.user);
  const zipcode = activeZip || user?.zipcode || '';

  const { groups, itemsWithoutLocation } = useMemo(() => groupCartByStore(items), [items]);
  const routeKey = `${groups.map(g => locationKey(g.location)).join(',')}|${zipcode}`;

  const [locationPromptSeen, setLocationPromptSeen] = useState(hasSeenLocationPrompt);
  const dismissLocationPrompt = () => {
    sessionStorage.setItem(LOCATION_PROMPT_SESSION_KEY, '1');
    setLocationPromptSeen(true);
  };
  const handleShareLocation = async () => {
    // Errors (denied/unavailable/timeout) resolve to null — tripService's
    // own getCurrentCoordinates() fallback to the saved ZIP still applies,
    // exactly as if the shopper had tapped "skip" instead.
    await requestPreciseLocation();
    dismissLocationPrompt();
  };

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <AppHeader back={{ onClick: () => router.push('/'), title: 'Your Route' }} />

      {items.length === 0 ? (
        <CenterState icon="cart" text="Your cart is empty — add items to plan a route." />
      ) : groups.length === 0 ? (
        <CenterState icon="warning" text="None of the items in your cart can be routed to yet — we don't have a store location for:">
          {itemsWithoutLocation.map(item => (
            <p key={item.product.id} className="text-amber-800 text-xs font-semibold mt-1">
              • {item.product.name} ({item.product.store})
            </p>
          ))}
        </CenterState>
      ) : !locationPromptSeen ? (
        <LocationPermissionModal onShare={handleShareLocation} onSkip={dismissLocationPrompt} />
      ) : (
        <TripLoader
          key={routeKey}
          groups={groups}
          zipcode={zipcode}
          itemsWithoutLocation={itemsWithoutLocation}
        />
      )}
    </main>
  );
}

function CenterState({ icon, text, children }: { icon: 'cart' | 'warning'; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
      {icon === 'cart' ? (
        <svg className="w-10 h-10 text-[#1A1A1A]/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ) : (
        <svg className="w-10 h-10 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      )}
      <p className="text-[#1A1A1A]/70 text-sm max-w-sm">{text}</p>
      {children}
    </div>
  );
}

function TripLoader({ groups, zipcode, itemsWithoutLocation }: {
  groups: StoreGroup[];
  zipcode: string;
  itemsWithoutLocation: CartItem[];
}) {
  const [trip, setTrip] = useState<TripPlan | null>(null);
  const [tripStartTime, setTripStartTime] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    planShoppingTrip(groups.map(g => g.location), zipcode)
      .then(plan => {
        if (cancelled) return;
        setTrip(plan);
        setTripStartTime(Date.now());
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not plan a route.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Remounted (via `key` on the parent) whenever groups/zipcode actually
    // change, so a plain mount-once effect is correct here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groupByKey = useMemo(() => {
    const map = new Map<string, StoreGroup>();
    for (const g of groups) map.set(locationKey(g.location), g);
    return map;
  }, [groups]);

  const stopKeys = useMemo(() => trip?.stops.map(s => locationKey(s.location)) ?? [], [trip]);
  const tripSignature = useMemo(() => computeTripSignature(stopKeys), [stopKeys]);

  const hydrateForTrip = useRouteStore(s => s.hydrateForTrip);
  useEffect(() => {
    if (trip) hydrateForTrip(tripSignature);
  }, [trip, tripSignature, hydrateForTrip]);

  const checklist = useRouteStore(s => s.checklist);
  const toggleItem = useRouteStore(s => s.toggleItem);
  const followMode = useRouteStore(s => s.followMode);
  const setFollowMode = useRouteStore(s => s.setFollowMode);
  const navigationMode = useRouteStore(s => s.navigationMode);
  const startNavigation = useRouteStore(s => s.startNavigation);
  const exitNavigation = useRouteStore(s => s.exitNavigation);

  const stopGroups = useMemo(
    () => trip?.stops.map(stop => groupByKey.get(locationKey(stop.location))) ?? [],
    [trip, groupByKey],
  );
  // Memoized, not recomputed fresh every render: RouteMap's one-time mount
  // effect depends on this array's identity to know "this is still the
  // same trip" — a fresh array reference on every render (checklist
  // ticks, follow-mode toggles, GPS updates) would make it look like a new
  // trip each time and destroy/recreate the whole map continuously.
  const stopStores: StoreName[] = useMemo(
    () => stopGroups.map(g => g?.items[0]?.product.store ?? "Trader Joe's"),
    [stopGroups],
  );
  const stopItems = useMemo(() => stopGroups.map(g => g?.items ?? []), [stopGroups]);

  const stopProgressList: StopProgress[] = useMemo(
    () => stopKeys.map((key, i) => computeStopProgress(stopItems[i] ?? [], checklist[key])),
    [stopKeys, stopItems, checklist],
  );

  const tripProgress: TripProgress | null = useMemo(
    () => (trip ? computeTripProgress(trip, stopItems, checklist, stopKeys) : null),
    [trip, stopItems, checklist, stopKeys],
  );

  // Pantry reminders need a real purchase log — the only real "this left
  // the store" signal is the shopper finishing a stop's own pickup
  // checklist. Records once per stop, the moment it flips to complete.
  const ownerEmail = useUserStore(s => s.user?.email ?? '');
  const recordedStops = useRef<Record<string, boolean>>({});
  useEffect(() => {
    if (!ownerEmail) return;
    stopKeys.forEach((key, i) => {
      const isComplete = stopProgressList[i]?.isComplete ?? false;
      if (isComplete && !recordedStops.current[key]) {
        recordedStops.current[key] = true;
        recordPurchases(ownerEmail, stopItems[i] ?? []);
      }
    });
  }, [ownerEmail, stopKeys, stopProgressList, stopItems]);

  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null);
  useEffect(() => subscribeToLiveLocation(setLiveLocation), []);

  const unresolvedItems = (trip?.unresolvedStops ?? []).flatMap(
    stop => groupByKey.get(locationKey(stop))?.items ?? [],
  );
  const unroutableItems = [...itemsWithoutLocation, ...unresolvedItems];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-[3px] border-[#2C742F]/30 border-t-[#2C742F] rounded-full animate-spin" />
        <p className="text-[#1A1A1A]/70 text-sm">Finding the best route to {groups.length} store{groups.length !== 1 ? 's' : ''}…</p>
      </div>
    );
  }

  if (error || !trip || !tripProgress) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-red-600 text-sm text-center">{error ?? 'Could not plan a route.'}</p>
      </div>
    );
  }

  // A single, stable <RouteMap> element for the whole trip — Overview and
  // Navigation Mode differ only in the CSS around it (and the `mode` prop
  // driving its internal camera transition), never in whether it exists.
  // Two separate conditional `return`s here would put RouteMap at a
  // different position in each render's tree, which React treats as
  // unmount-then-remount — exactly the "rebuild the map on every mode
  // switch" this component's own imperative update effects (GPS ticks,
  // checklist changes, camera transitions) are built to avoid.
  const isNavMode = navigationMode === 'navigation';
  const activeStop = trip.stops[tripProgress.activeStopIndex];
  const activeKey = activeStop ? stopKeys[tripProgress.activeStopIndex] : null;

  return (
    <div className={isNavMode ? 'flex-1 flex flex-col min-h-0' : 'flex-1 overflow-y-auto'}>
      <div className={isNavMode ? 'relative flex-1 min-h-0' : 'relative'}>
        <RouteMap
          trip={trip}
          stopStores={stopStores}
          stopProgress={stopProgressList}
          activeStopIndex={tripProgress.activeStopIndex}
          liveLocation={liveLocation}
          followMode={followMode}
          mode={navigationMode}
          onManualPan={() => setFollowMode(false)}
          onRecenter={() => setFollowMode(true)}
          className={isNavMode ? undefined : 'h-[340px] w-full'}
          fill={isNavMode}
        />
        {isNavMode && <NavigationBanner activeStop={activeStop} tripStartTime={tripStartTime} />}
      </div>

      {isNavMode ? (
        <NavigationPanel
          trip={trip}
          tripProgress={tripProgress}
          activeStop={activeStop}
          activeStopKey={activeKey}
          activeStopItems={activeStop ? stopItems[tripProgress.activeStopIndex] : []}
          checklist={activeKey ? (checklist[activeKey] ?? {}) : {}}
          onToggleItem={productId => activeKey && toggleItem(activeKey, productId)}
          onExit={exitNavigation}
          tripStartTime={tripStartTime}
        />
      ) : (
        <>
          <div className="px-4 mt-4">
            <button
              type="button"
              onClick={startNavigation}
              className="w-full flex items-center justify-center gap-2 bg-[#2C742F] hover:bg-[#255f27] text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-md"
            >
              <svg className="w-[17px] h-[17px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.874L6 12zm0 0h7.5" />
              </svg>
              {tripProgress.isTripComplete ? 'Review Route' : 'Start Route'}
            </button>
          </div>

          <div className="px-4 mt-4">
            <ContextualHint hintKey="route" message="Save money while keeping your trip efficient." />
          </div>

          <TripProgressHeader progress={tripProgress} />

          {unroutableItems.length > 0 && (
            <div className="flex items-start gap-2.5 mx-4 mt-4 bg-amber-50 rounded-xl p-3.5">
              <svg className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-amber-900 text-xs">
                  {unroutableItems.length} item{unroutableItems.length !== 1 ? 's' : ''} couldn&apos;t be included in
                  this route — routing can&apos;t continue to a store until a valid location is known for it:
                </p>
                {unroutableItems.map(item => (
                  <p key={item.product.id} className="text-amber-900 text-xs font-semibold mt-1">
                    • {item.product.name} ({item.product.store})
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 mt-6 mb-2">
            <h2 className="text-[#1A1A1A] font-bold text-[15px]">Stops</h2>
          </div>
          <div className="pb-8">
            {trip.stops.map((stop, i) => (
              <StopCard
                key={stopKeys[i]}
                index={i}
                stop={stop}
                store={stopStores[i]}
                items={stopItems[i]}
                progress={stopProgressList[i]}
                isActive={i === tripProgress.activeStopIndex}
                isFirst={i === 0}
                isLast={i === trip.stops.length - 1}
                tripStartTime={tripStartTime}
                checklist={checklist[stopKeys[i]] ?? {}}
                onToggleItem={productId => toggleItem(stopKeys[i], productId)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function NavigationBanner({ activeStop, tripStartTime }: {
  activeStop: TripPlan['stops'][number] | undefined;
  tripStartTime: number;
}) {
  if (!activeStop) return null;
  const eta = new Date(tripStartTime + activeStop.cumulativeEtaMinutes * 60000);
  const etaLabel = eta.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const instruction = activeStop.nextManeuver ?? `Head toward ${activeStop.location.name}`;

  return (
    <div className="absolute top-3 left-3 right-3 flex items-center gap-2.5 bg-[#1A1A1A] rounded-xl py-2.5 px-3.5 shadow-lg">
      <div className="w-[30px] h-[30px] rounded-full bg-[#2C742F] flex items-center justify-center shrink-0">
        <svg className="w-[17px] h-[17px] text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12L3.269 3.126A59.769 59.769 0 0121.485 12 59.768 59.768 0 013.27 20.874L6 12zm0 0h7.5" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white font-bold text-sm truncate">{instruction}</p>
        <p className="text-white/70 text-[11.5px] truncate">
          {activeStop.legDistanceMiles.toFixed(1)} mi to {activeStop.location.name} · ETA {etaLabel}
        </p>
      </div>
    </div>
  );
}

function NavigationPanel({
  trip, tripProgress, activeStop, activeStopKey, activeStopItems, checklist, onToggleItem, onExit, tripStartTime,
}: {
  trip: TripPlan;
  tripProgress: TripProgress;
  activeStop: TripPlan['stops'][number] | undefined;
  activeStopKey: string | null;
  activeStopItems: CartItem[];
  checklist: Record<string, boolean>;
  onToggleItem: (productId: string) => void;
  onExit: () => void;
  tripStartTime: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const prevStopKey = useRef<string | null>(null);
  useEffect(() => {
    if (activeStopKey && activeStopKey !== prevStopKey.current) setExpanded(true);
    prevStopKey.current = activeStopKey;
  }, [activeStopKey]);

  const finalStop = trip.stops[trip.stops.length - 1];
  const tripEta = new Date(tripStartTime + finalStop.cumulativeEtaMinutes * 60000);
  const tripEtaLabel = tripEta.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  return (
    <div className="bg-white border-t border-gray-100 px-4 pt-3 pb-5 shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        disabled={!activeStop}
        className="w-full flex items-start gap-2 text-left"
      >
        <div className="flex-1">
          <p className="text-[#2C742F] font-bold text-[10.5px] tracking-wide">
            {activeStop ? `STORE ${tripProgress.activeStopIndex + 1} OF ${trip.stops.length}` : 'TRIP COMPLETE'}
          </p>
          <p className="text-[#1A1A1A] font-extrabold text-[17px] mt-0.5">
            {activeStop ? activeStop.location.name : 'Nice work — all stops done!'}
          </p>
        </div>
        {activeStop && (
          <svg className={`w-[18px] h-[18px] text-[#1A1A1A]/40 mt-1 transition-transform ${expanded ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      <div className="flex justify-around bg-[#E0F3E2] mt-3 rounded-xl py-2.5">
        <NavStat value={formatDuration(tripProgress.remainingDurationMinutes)} label="Time left" />
        <NavStat value={`${tripProgress.remainingDistanceMiles.toFixed(1)} mi`} label="Distance" />
        <NavStat value={String(tripProgress.remainingStores)} label="Stores left" />
        <NavStat value={tripProgress.isTripComplete ? '—' : tripEtaLabel} label="ETA" />
      </div>

      {expanded && activeStop && (
        <div className="mt-3 max-h-[220px] overflow-y-auto space-y-2">
          {activeStopItems.map(item => (
            <ChecklistRow
              key={item.product.id}
              item={item}
              checked={!!checklist[item.product.id]}
              onToggle={() => onToggleItem(item.product.id)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onExit}
        className="flex items-center gap-1.5 mx-auto mt-3 text-[#1A1A1A]/60 text-xs font-semibold"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        Back to overview
        <span className="text-[#1A1A1A]/30 font-normal ml-1">{trip.stops.length} stop{trip.stops.length !== 1 ? 's' : ''}</span>
      </button>
    </div>
  );
}

function NavStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[#1A1A1A] font-bold text-[13.5px]">{value}</span>
      <span className="text-[#1A1A1A]/60 text-[9.5px]">{label}</span>
    </div>
  );
}

function TripProgressHeader({ progress }: { progress: TripProgress }) {
  return (
    <div className="px-4 mt-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[#1A1A1A] font-bold text-[14.5px]">
          {progress.isTripComplete ? 'Trip complete — nice work!' : `${progress.checkedItems} / ${progress.totalItems} items collected`}
        </p>
        <p className="text-[#2C742F] font-extrabold text-[14.5px]">{progress.percentComplete}%</p>
      </div>
      <div className="h-2 rounded-full bg-gray-100 mt-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${progress.isTripComplete ? 'bg-emerald-600' : 'bg-[#2C742F]'}`}
          style={{ width: `${progress.percentComplete}%` }}
        />
      </div>

      <div className="grid grid-cols-4 bg-[#E0F3E2] mt-4 rounded-xl py-3">
        <SummaryStat value={formatDuration(progress.remainingDurationMinutes)} label="Time left" />
        <SummaryStat value={`${progress.remainingDistanceMiles.toFixed(1)} mi`} label="Left to drive" />
        <SummaryStat value={String(progress.remainingStores)} label={progress.remainingStores === 1 ? 'Store left' : 'Stores left'} />
        <SummaryStat value={String(progress.remainingItems)} label={progress.remainingItems === 1 ? 'Item left' : 'Items left'} />
      </div>
    </div>
  );
}

function SummaryStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[#1A1A1A] font-bold text-[15px]">{value}</span>
      <span className="text-[#1A1A1A]/60 text-[10.5px] text-center">{label}</span>
    </div>
  );
}

function StopCard({ index, stop, store, items, progress, isActive, isFirst, isLast, tripStartTime, checklist, onToggleItem }: {
  index: number;
  stop: TripPlan['stops'][number];
  store: StoreName;
  items: CartItem[];
  progress: StopProgress;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  tripStartTime: number;
  checklist: Record<string, boolean>;
  onToggleItem: (productId: string) => void;
}) {
  const accent = storeAccents[store];
  const arrival = new Date(tripStartTime + stop.cumulativeEtaMinutes * 60000);
  const arrivalLabel = arrival.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  const [collapsed, setCollapsed] = useState(progress.isComplete);
  const wasComplete = useRef(progress.isComplete);
  useEffect(() => {
    if (progress.isComplete && !wasComplete.current) setCollapsed(true);
    wasComplete.current = progress.isComplete;
  }, [progress.isComplete]);

  return (
    <div className={`flex px-4 mt-3 py-2 rounded-xl ${isActive ? 'bg-[#E0F3E2]' : ''}`}>
      <div className="flex flex-col items-center w-8 shrink-0">
        <div
          className="w-[26px] h-[26px] rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: progress.isComplete ? '#9CA3AF' : accent.dot }}
        >
          {progress.isComplete ? (
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <span className="text-white font-bold text-xs">{index + 1}</span>
          )}
        </div>
        {!isLast && <div className="flex-1 w-0.5 bg-gray-100 my-1 min-h-[24px]" />}
      </div>

      <div className="flex-1 ml-3 pb-2 min-w-0">
        <button type="button" onClick={() => setCollapsed(c => !c)} className="w-full text-left">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              {isActive && <p className="text-[#2C742F] font-bold text-[10.5px] tracking-wide mb-1">CURRENT DESTINATION</p>}
              {progress.isComplete && !isActive && <p className="text-[#1A1A1A]/60 font-bold text-[10.5px] tracking-wide mb-1">PICKED UP</p>}
              <p className="text-[#1A1A1A] font-bold text-[14.5px]">{stop.location.name}</p>
              <p className="text-[#1A1A1A]/60 text-[12.5px] mt-0.5">
                {stop.location.address}, {stop.location.city}, {stop.location.state} {stop.location.zip}
              </p>
            </div>
            <svg className={`w-[18px] h-[18px] text-[#1A1A1A]/40 shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          <div className="flex flex-wrap gap-x-2 mt-1.5">
            <span className="text-[#1A1A1A]/45 text-[11.5px]">
              {formatDuration(stop.legDurationMinutes)} drive from {isFirst ? 'your location' : 'previous stop'}
            </span>
            <span className="text-[#1A1A1A]/45 text-[11.5px]">· Arrive ~{arrivalLabel}</span>
          </div>
          {stop.nextManeuver && <p className="text-[#2C742F] text-[11.5px] mt-1 italic">{stop.nextManeuver}</p>}

          {progress.totalItems > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress.percentComplete}%`, backgroundColor: progress.isComplete ? '#9CA3AF' : accent.dot }}
                />
              </div>
              <span className="text-[#1A1A1A]/60 text-[11px] font-semibold shrink-0">{progress.checkedItems}/{progress.totalItems} collected</span>
            </div>
          )}
        </button>

        {!collapsed && (
          <div className="mt-3 space-y-2">
            {items.map(item => (
              <ChecklistRow
                key={item.product.id}
                item={item}
                checked={!!checklist[item.product.id]}
                onToggle={() => onToggleItem(item.product.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChecklistRow({ item, checked, onToggle }: { item: CartItem; checked: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="flex items-center gap-2.5 w-full text-left min-h-[32px]">
      <span
        className={`w-[22px] h-[22px] rounded-md border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
          checked ? 'bg-[#2C742F] border-[#2C742F]' : 'bg-white border-gray-200'
        }`}
      >
        {checked && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      <span className={`text-[12.5px] flex-1 ${checked ? 'text-[#1A1A1A]/40 line-through' : 'text-[#1A1A1A]'}`}>
        {item.product.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}
      </span>
    </button>
  );
}
