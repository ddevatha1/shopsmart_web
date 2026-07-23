import { create } from 'zustand';
import { onboardingRepository, type HintKey, type OnboardingState } from '@/repositories/onboardingRepository';

interface OnboardingStoreState {
  completed: boolean;
  hintsSeen: Partial<Record<HintKey, boolean>>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  /** Called once a visitor reaches the real app for the first time (Get
   * Started / Skip) — never shown again after this, until
   * resetOnboarding() explicitly reverses it. */
  completeOnboarding: () => Promise<void>;
  /** "Restart Onboarding" in the Profile tray — re-arms the Welcome
   * overlay *and* every contextual hint, so a visitor who asks to see it
   * again gets the full experience, not just the welcome screen with
   * none of the hints that made it useful the first time. */
  resetOnboarding: () => Promise<void>;
  markHintSeen: (key: HintKey) => Promise<void>;
  isHintSeen: (key: HintKey) => boolean;
}

async function persist(next: OnboardingState): Promise<void> {
  await onboardingRepository.save(next);
}

export const useOnboardingStore = create<OnboardingStoreState>((set, get) => ({
  completed: false,
  hintsSeen: {},
  hydrated: false,

  hydrate: async () => {
    const state = await onboardingRepository.load();
    set({ completed: state.completed, hintsSeen: state.hintsSeen, hydrated: true });
  },

  completeOnboarding: async () => {
    set({ completed: true });
    await persist({ completed: true, hintsSeen: get().hintsSeen });
  },

  resetOnboarding: async () => {
    set({ completed: false, hintsSeen: {} });
    await persist({ completed: false, hintsSeen: {} });
  },

  markHintSeen: async (key) => {
    const hintsSeen = { ...get().hintsSeen, [key]: true };
    set({ hintsSeen });
    await persist({ completed: get().completed, hintsSeen });
  },

  isHintSeen: (key) => get().hintsSeen[key] === true,
}));
