/**
 * Persisted onboarding state — deliberately independent of userRepository
 * (the signed-in account): a visitor needs a "have they seen onboarding
 * yet" answer before an account exists (anonymous browsing is allowed on
 * web), and the contextual-hint history shouldn't reset just because they
 * signed out and back in. Direct port of shopsmart_mobile's
 * onboardingRepository.ts, localStorage instead of AsyncStorage — same
 * key/JSON pattern as userRepository.ts.
 */
const ONBOARDING_KEY = 'shopsmart_onboarding_v1';

export type HintKey = 'search-suggestions' | 'search-compare' | 'compare' | 'cart' | 'route';

export interface OnboardingState {
  completed: boolean;
  hintsSeen: Partial<Record<HintKey, boolean>>;
}

function defaultState(): OnboardingState {
  return { completed: false, hintsSeen: {} };
}

export const onboardingRepository = {
  async load(): Promise<OnboardingState> {
    if (typeof window === 'undefined') return defaultState();
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return defaultState();
    try {
      const parsed = JSON.parse(raw) as Partial<OnboardingState>;
      return {
        completed: parsed.completed ?? false,
        hintsSeen: parsed.hintsSeen ?? {},
      };
    } catch {
      return defaultState();
    }
  },

  async save(state: OnboardingState): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  },
};
