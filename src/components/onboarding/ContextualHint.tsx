'use client';

import { useOnboardingStore } from '@/store/onboardingStore';
import type { HintKey } from '@/repositories/onboardingRepository';

interface ContextualHintProps {
  /** Which persisted "have I shown this before" slot this hint occupies —
   * see onboardingRepository's HintKey. Once dismissed, this exact hint
   * never renders again in this browser. */
  hintKey: HintKey;
  message: string;
  title?: string;
}

/**
 * The app's one reusable "teach this concept, once, right when it's
 * relevant" building block — direct port of shopsmart_mobile's
 * ContextualHint. Callers just render this inline wherever the concept
 * first becomes relevant (e.g. CartDrawer renders
 * `<ContextualHint hintKey="cart" .../>` once the cart has its first
 * item) — this component owns all of the "has this been seen/dismissed
 * before" bookkeeping itself.
 *
 * Deliberately not a floating tooltip anchored to a specific element — a
 * plain inline dismissible banner reads just as clearly and needs no
 * per-page positioning math.
 */
export function ContextualHint({ hintKey, message, title }: ContextualHintProps) {
  const isSeen = useOnboardingStore(s => s.isHintSeen(hintKey));
  const markHintSeen = useOnboardingStore(s => s.markHintSeen);
  const hydrated = useOnboardingStore(s => s.hydrated);

  // Wait for hydration before deciding — otherwise a hint that was already
  // seen on a previous visit would flash visible for one frame while
  // localStorage is still being read.
  if (!hydrated || isSeen) return null;

  return (
    <div className="flex items-start gap-2.5 bg-[#E0F3E2] rounded-2xl px-4 py-3 animate-results-fade-in">
      <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5">
        <svg className="w-3.5 h-3.5 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        {!!title && <p className="text-[#2C742F] text-sm font-semibold mb-0.5">{title}</p>}
        <p className="text-[#1A1A1A]/70 text-sm leading-snug">{message}</p>
      </div>
      <button
        type="button"
        onClick={() => markHintSeen(hintKey)}
        aria-label="Dismiss tip"
        className="text-[#1A1A1A]/40 hover:text-[#1A1A1A]/70 transition-colors shrink-0 mt-0.5"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
