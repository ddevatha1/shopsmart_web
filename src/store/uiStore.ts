import { create } from 'zustand';

/**
 * Web-only UI state for the three global overlays (Auth, Cart, Profile) —
 * mobile has no equivalent (they're separate bottom-nav tabs there, always
 * on screen, never toggled). Lives in its own store rather than each
 * page's local useState so every routed page (Search, Compare, Product
 * Detail, Route) can open the same Cart/Profile drawers from a shared
 * header, without prop-drilling open/close state through the App Router's
 * separate page trees.
 */
interface UiState {
  authOpen: boolean;
  cartOpen: boolean;
  profileOpen: boolean;
  openAuth: () => void;
  closeAuth: () => void;
  openCart: () => void;
  closeCart: () => void;
  openProfile: () => void;
  closeProfile: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  authOpen: false,
  cartOpen: false,
  profileOpen: false,
  openAuth: () => set({ authOpen: true }),
  closeAuth: () => set({ authOpen: false }),
  openCart: () => set({ cartOpen: true, profileOpen: false }),
  closeCart: () => set({ cartOpen: false }),
  openProfile: () => set({ profileOpen: true, cartOpen: false }),
  closeProfile: () => set({ profileOpen: false }),
}));
