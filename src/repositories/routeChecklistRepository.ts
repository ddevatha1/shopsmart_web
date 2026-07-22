import type { TripChecklist } from '@/services/navigationController';

/**
 * Persists which items have been checked off during the *currently active*
 * trip, keyed by the trip's signature, so reopening the Route page for the
 * same set of stops resumes exactly where the shopper left off. Direct
 * port of shopsmart_mobile's routeChecklistRepository.ts (localStorage
 * instead of AsyncStorage). Not scoped per-account — a trip in progress
 * belongs to whoever's browser it's on.
 */
const ACTIVE_TRIP_KEY = 'shopsmart_route_active_trip';

interface StoredChecklist {
  tripSignature: string;
  checklist: TripChecklist;
}

export const routeChecklistRepository = {
  async load(tripSignature: string): Promise<TripChecklist> {
    if (typeof window === 'undefined') return {};
    const raw = window.localStorage.getItem(ACTIVE_TRIP_KEY);
    if (!raw) return {};
    try {
      const stored = JSON.parse(raw) as StoredChecklist;
      return stored.tripSignature === tripSignature ? stored.checklist : {};
    } catch {
      return {};
    }
  },

  async save(tripSignature: string, checklist: TripChecklist): Promise<void> {
    if (typeof window === 'undefined') return;
    const stored: StoredChecklist = { tripSignature, checklist };
    window.localStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(stored));
  },

  async clear(): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACTIVE_TRIP_KEY);
  },
};
