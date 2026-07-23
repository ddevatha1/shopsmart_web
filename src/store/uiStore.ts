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
  /** Which tab AuthModal should open on — set by openAuth's argument, read
   * by GlobalOverlays when it mounts AuthModal. Defaults to 'signin' since
   * that's every existing call site's (AppHeader's "Sign In" button)
   * behavior; only the onboarding overlay's "Get Started" passes 'signup'. */
  authInitialMode: 'signin' | 'signup';
  cartOpen: boolean;
  profileOpen: boolean;
  onboardingOpen: boolean;
  openAuth: (mode?: 'signin' | 'signup') => void;
  closeAuth: () => void;
  openCart: () => void;
  closeCart: () => void;
  openProfile: () => void;
  closeProfile: () => void;
  openOnboarding: () => void;
  closeOnboarding: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  authOpen: false,
  authInitialMode: 'signin',
  cartOpen: false,
  profileOpen: false,
  onboardingOpen: false,
  openAuth: (mode = 'signin') => set({ authOpen: true, authInitialMode: mode }),
  closeAuth: () => set({ authOpen: false }),
  openCart: () => set({ cartOpen: true, profileOpen: false }),
  closeCart: () => set({ cartOpen: false }),
  openProfile: () => set({ profileOpen: true, cartOpen: false }),
  closeProfile: () => set({ profileOpen: false }),
  openOnboarding: () => set({ onboardingOpen: true }),
  closeOnboarding: () => set({ onboardingOpen: false }),
}));
