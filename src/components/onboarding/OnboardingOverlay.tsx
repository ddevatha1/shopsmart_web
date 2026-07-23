'use client';

import { useUserStore } from '@/store/userStore';
import { useOnboardingStore } from '@/store/onboardingStore';

interface OnboardingOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: (mode: 'signin' | 'signup') => void;
}

/**
 * The app's entire first-visit onboarding UI — deliberately just one
 * screen. One sentence explaining what the app does, one primary action,
 * one small way out. Everything a multi-slide feature carousel would
 * otherwise explain up front is instead taught the first time it's
 * actually relevant, via ContextualHint banners on the real
 * pages/components (see page.tsx, ComparisonView, CartDrawer, route
 * page). "Teach only what the user needs right now." Direct port of
 * shopsmart_mobile's (now-merged) OnboardingScreen/WelcomeScreen.
 *
 * Unlike mobile, web already allows anonymous browsing (the hero search
 * itself doesn't require a signed-in session), so "Skip" just dismisses
 * with no forced sign-in — signing up only ever happens when the visitor
 * chooses to.
 *
 * Reached two ways:
 *  - First visit (via GlobalOverlays' post-hydration check).
 *  - "Restart Onboarding" in the Profile tray, already signed in — there
 *    is nothing to sign up for again, so the single action just
 *    re-arms the contextual hints and closes.
 */
export function OnboardingOverlay({ isOpen, onClose, onOpenAuth }: OnboardingOverlayProps) {
  const user = useUserStore(s => s.user);
  const completeOnboarding = useOnboardingStore(s => s.completeOnboarding);
  const isReplay = user != null;

  if (!isOpen) return null;

  async function handlePrimaryAction() {
    await completeOnboarding();
    onClose();
    if (!isReplay) onOpenAuth('signup');
  }

  function handleSkip() {
    completeOnboarding();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to ShopSmart"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      <div className="relative bg-gradient-to-b from-[#E0F3E2] to-white rounded-3xl shadow-2xl w-full max-w-md mx-4 px-8 py-12 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-[#E0F3E2] border border-[#D0EBD2] flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        </div>

        <span className="text-lg font-extrabold tracking-tight text-[#1A1A1A] mb-4">
          Shop<span className="text-[#2C742F]">Smart</span>
        </span>

        <h1 className="text-3xl font-extrabold text-[#1A1A1A] leading-tight mb-8 max-w-xs">
          {isReplay ? 'Welcome back.' : 'Shop smarter. Find better grocery prices across your favorite stores.'}
        </h1>

        <div className="w-full space-y-2">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="w-full bg-[#2C742F] hover:bg-[#255f27] text-white font-semibold py-4 rounded-xl transition-colors text-sm shadow-md"
          >
            {isReplay ? 'Continue' : 'Get Started'}
          </button>
          {!isReplay && (
            <button
              type="button"
              onClick={handleSkip}
              className="w-full text-[#1A1A1A]/50 hover:text-[#1A1A1A]/70 font-medium py-2.5 text-sm transition-colors"
            >
              Skip
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
