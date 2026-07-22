import { create } from 'zustand';
import { routeChecklistRepository } from '@/repositories/routeChecklistRepository';
import type { TripChecklist } from '@/services/navigationController';

export type NavigationMode = 'overview' | 'navigation';

/**
 * The "RouteStateManager" — owns everything about the *currently active*
 * trip that isn't the routing plan itself: which items have been checked
 * off at each stop, whether the map is following the shopper's live
 * position, and which of the two map modes (Trip Overview / Navigation) is
 * active. Direct port of shopsmart_mobile's routeStore.ts.
 */
interface RouteState {
  tripSignature: string | null;
  checklist: TripChecklist;
  hydrated: boolean;
  followMode: boolean;
  navigationMode: NavigationMode;

  hydrateForTrip: (tripSignature: string) => Promise<void>;
  toggleItem: (stopKey: string, productId: string) => void;
  setFollowMode: (following: boolean) => void;
  startNavigation: () => void;
  exitNavigation: () => void;
  clearTrip: () => Promise<void>;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  tripSignature: null,
  checklist: {},
  hydrated: false,
  followMode: true,
  navigationMode: 'overview',

  hydrateForTrip: async (tripSignature) => {
    if (get().tripSignature === tripSignature && get().hydrated) return;
    const checklist = await routeChecklistRepository.load(tripSignature);
    set({ tripSignature, checklist, hydrated: true, followMode: true, navigationMode: 'overview' });
  },

  toggleItem: (stopKey, productId) => {
    const { tripSignature, checklist } = get();
    if (!tripSignature) return;
    const stopChecklist = { ...checklist[stopKey], [productId]: !checklist[stopKey]?.[productId] };
    const nextChecklist = { ...checklist, [stopKey]: stopChecklist };
    set({ checklist: nextChecklist });
    routeChecklistRepository.save(tripSignature, nextChecklist);
  },

  setFollowMode: (following) => set({ followMode: following }),

  startNavigation: () => set({ navigationMode: 'navigation', followMode: true }),
  exitNavigation: () => set({ navigationMode: 'overview' }),

  clearTrip: async () => {
    set({ tripSignature: null, checklist: {}, hydrated: false, followMode: true, navigationMode: 'overview' });
    await routeChecklistRepository.clear();
  },
}));
