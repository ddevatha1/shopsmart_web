import type { CartItem, TripPlan } from '@/types';

/**
 * The "NavigationController" — every derived-state computation the Route
 * page needs (per-stop pickup progress, which stop is "active," overall
 * trip progress, remaining distance/time) lives here as plain functions,
 * not inline in a component. Direct, verbatim port of
 * shopsmart_mobile's navigationController.ts (pure TS, no RN dependency).
 */
export type StopChecklist = Record<string, boolean>;
export type TripChecklist = Record<string, StopChecklist>;

export interface StopProgress {
  totalItems: number;
  checkedItems: number;
  isComplete: boolean;
  percentComplete: number;
}

export function computeStopProgress(items: CartItem[], checklist: StopChecklist | undefined): StopProgress {
  const totalItems = items.length;
  const checkedItems = items.filter((item) => checklist?.[item.product.id]).length;
  return {
    totalItems,
    checkedItems,
    isComplete: totalItems > 0 && checkedItems === totalItems,
    percentComplete: totalItems === 0 ? 0 : Math.round((checkedItems / totalItems) * 100),
  };
}

export interface TripProgress {
  totalItems: number;
  checkedItems: number;
  remainingItems: number;
  totalStores: number;
  completeStores: number;
  remainingStores: number;
  /** Index into `trip.stops` of the first not-yet-complete stop — the
   * "current destination." Equal to `trip.stops.length` once every stop
   * is done. */
  activeStopIndex: number;
  isTripComplete: boolean;
  percentComplete: number;
  remainingDistanceMiles: number;
  remainingDurationMinutes: number;
}

/**
 * `stopItems[i]` must be the cart items picked up at `trip.stops[i]` (same
 * order) — the Route page derives this via `groupCartByStore` + `locationKey`
 * matching.
 */
export function computeTripProgress(
  trip: TripPlan,
  stopItems: CartItem[][],
  checklist: TripChecklist,
  stopKeys: string[],
): TripProgress {
  const perStop = trip.stops.map((_, i) => computeStopProgress(stopItems[i] ?? [], checklist[stopKeys[i]]));

  const totalItems = perStop.reduce((sum, s) => sum + s.totalItems, 0);
  const checkedItems = perStop.reduce((sum, s) => sum + s.checkedItems, 0);
  const completeStores = perStop.filter((s) => s.isComplete).length;

  let activeStopIndex = perStop.findIndex((s) => !s.isComplete);
  if (activeStopIndex === -1) activeStopIndex = trip.stops.length;

  let remainingDistanceMiles = 0;
  let remainingDurationMinutes = 0;
  for (let i = activeStopIndex; i < trip.stops.length; i++) {
    remainingDistanceMiles += trip.stops[i].legDistanceMiles;
    remainingDurationMinutes += trip.stops[i].legDurationMinutes;
  }

  return {
    totalItems,
    checkedItems,
    remainingItems: totalItems - checkedItems,
    totalStores: trip.stops.length,
    completeStores,
    remainingStores: trip.stops.length - completeStores,
    activeStopIndex,
    isTripComplete: trip.stops.length > 0 && completeStores === trip.stops.length,
    percentComplete: totalItems === 0 ? 0 : Math.round((checkedItems / totalItems) * 100),
    remainingDistanceMiles,
    remainingDurationMinutes,
  };
}

/** A stable identity for "this exact trip" (same set of stops) — used to
 * decide whether persisted checklist state should carry over or reset. */
export function computeTripSignature(stopKeys: string[]): string {
  return [...stopKeys].sort().join('|');
}
