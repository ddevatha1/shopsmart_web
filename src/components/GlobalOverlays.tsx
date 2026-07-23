'use client';

import { useEffect } from 'react';
import AuthModal from '@/components/AuthModal';
import CartDrawer from '@/components/CartDrawer';
import ProfileTray from '@/components/ProfileTray';
import { OnboardingOverlay } from '@/components/onboarding/OnboardingOverlay';
import { useUserStore } from '@/store/userStore';
import { useCartStore } from '@/store/cartStore';
import { useSearchStore } from '@/store/searchStore';
import { useUiStore } from '@/store/uiStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useWarmupStore } from '@/store/warmupStore';
import { perfLog } from '@/utils/perfLog';

/**
 * Renders the three global overlays exactly once, at the root layout, so
 * every routed page shares one Cart drawer / Profile tray / Auth modal
 * instead of each page instantiating (and hydrating) its own copy. Open/
 * close state lives in uiStore; AppHeader (rendered per-page) is what
 * actually triggers these. Also the app-open instrumentation point: this
 * module loads once per page load, close enough to "app open" for the
 * `[Perf] app:start` baseline every other client-side perf log is measured
 * relative to (see utils/perfLog.ts).
 */
perfLog('app:start');

export default function GlobalOverlays() {
  const user = useUserStore(s => s.user);
  const hydrateUser = useUserStore(s => s.hydrate);
  const cartItems = useCartStore(s => s.items);
  const hydrateCart = useCartStore(s => s.hydrate);
  const updateCartQty = useCartStore(s => s.updateQty);
  const removeFromCart = useCartStore(s => s.remove);
  const activeZip = useSearchStore(s => s.activeZip);
  const warmup = useWarmupStore(s => s.warmup);

  const authOpen = useUiStore(s => s.authOpen);
  const authInitialMode = useUiStore(s => s.authInitialMode);
  const closeAuth = useUiStore(s => s.closeAuth);
  const openAuth = useUiStore(s => s.openAuth);
  const cartOpen = useUiStore(s => s.cartOpen);
  const closeCart = useUiStore(s => s.closeCart);
  const profileOpen = useUiStore(s => s.profileOpen);
  const closeProfile = useUiStore(s => s.closeProfile);
  const onboardingOpen = useUiStore(s => s.onboardingOpen);
  const closeOnboarding = useUiStore(s => s.closeOnboarding);
  const openOnboarding = useUiStore(s => s.openOnboarding);
  const hydrateOnboarding = useOnboardingStore(s => s.hydrate);

  useEffect(() => {
    hydrateUser().then(() => {
      // Background warm-up (backend session/store-location init) — fired
      // once per app load, deliberately not awaited: the homepage must
      // never wait on this. Uses the shopper's saved zip if they've signed
      // in before, so the zip-specific nearest-store lookups warm up too,
      // not just the zip-independent session/token pieces. See
      // warmupStore.ts for the dedup guard that keeps this safe to call
      // again on remount.
      const zipcode = useUserStore.getState().user?.zipcode;
      warmup(zipcode);
    });
  }, [hydrateUser, warmup]);
  useEffect(() => {
    hydrateCart();
  }, [hydrateCart]);
  useEffect(() => {
    hydrateOnboarding().then(() => {
      if (!useOnboardingStore.getState().completed) openOnboarding();
    });
  }, [hydrateOnboarding, openOnboarding]);

  return (
    <>
      <OnboardingOverlay
        isOpen={onboardingOpen}
        onClose={closeOnboarding}
        onOpenAuth={mode => openAuth(mode)}
      />

      <AuthModal
        key={authOpen ? 'auth-open' : 'auth-closed'}
        isOpen={authOpen}
        onClose={closeAuth}
        onAuth={u => useUserStore.getState().signIn(u)}
        initialMode={authInitialMode}
      />

      <CartDrawer
        isOpen={cartOpen}
        onClose={closeCart}
        items={cartItems}
        onUpdateQty={updateCartQty}
        onRemove={removeFromCart}
        zipcode={activeZip || (user?.zipcode ?? '')}
      />

      {user && (
        <ProfileTray
          isOpen={profileOpen}
          onClose={closeProfile}
          user={user}
          cartItems={cartItems}
          onSignOut={() => useUserStore.getState().signOut()}
        />
      )}
    </>
  );
}
