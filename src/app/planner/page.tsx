'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { SearchProgress } from '@/components/search/SearchProgress';
import AmbiguityCard from '@/components/planner/AmbiguityCard';
import PlanResultsView from '@/components/planner/PlanResultsView';
import { useUserStore } from '@/store/userStore';
import { useCartStore } from '@/store/cartStore';
import { parseListInput, analyzeItems, applyAmbiguityAnswers } from '@/services/plannerAmbiguityService';
import { getAllPreferences, setPreference } from '@/services/plannerPreferenceService';
import { generateShoppingPlan, PlannerApiError } from '@/services/plannerService';
import { perfLog } from '@/utils/perfLog';
import type { AmbiguityPrompt, CartItem, PlanCandidate, PlannerListItem, ShoppingPlanResponse } from '@/types';

type Step = 'input' | 'clarify' | 'loading' | 'results' | 'error';

/**
 * The Smart Shopping Planner — one page, internal step state, per the
 * "minimize screens" requirement. Ambiguity resolution (analyzeItems) runs
 * entirely client-side/instantly, so the clarify step only ever appears
 * when it genuinely improves the plan and is skipped outright otherwise.
 */
export default function PlannerPage() {
  const router = useRouter();
  const user = useUserStore(s => s.user);
  const setCart = useCartStore(s => s.setCart);
  const zipcode = user?.zipcode ?? '';

  const [step, setStep] = useState<Step>('input');
  const [listText, setListText] = useState('');
  const [resolvedItems, setResolvedItems] = useState<PlannerListItem[]>([]);
  const [prompts, setPrompts] = useState<AmbiguityPrompt[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [rememberChoices, setRememberChoices] = useState(true);
  const [plan, setPlan] = useState<ShoppingPlanResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSubmit = listText.trim().length > 0 && zipcode.length === 5;

  const runOptimization = useCallback(async (items: PlannerListItem[]) => {
    setStep('loading');
    try {
      const result = await generateShoppingPlan(items, zipcode);
      setPlan(result);
      setStep('results');
    } catch (err) {
      setErrorMessage(err instanceof PlannerApiError ? err.message : 'Could not build a shopping plan.');
      setStep('error');
    }
  }, [zipcode]);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !user) return;

    const rawItems = parseListInput(listText);
    const rememberedPrefs = await getAllPreferences(user.email);
    const { resolved, prompts: newPrompts } = analyzeItems(rawItems, rememberedPrefs);

    setResolvedItems(resolved);

    if (newPrompts.length === 0) {
      await runOptimization(resolved);
      return;
    }

    const initialAnswers: Record<string, string | null> = {};
    for (const p of newPrompts) {
      initialAnswers[p.taxonomyEntryId] = p.rememberedDefault ?? null;
    }
    setAnswers(initialAnswers);
    setPrompts(newPrompts);
    setStep('clarify');
  };

  const handleContinueFromClarify = async () => {
    const finalItems = applyAmbiguityAnswers(resolvedItems, answers);
    setResolvedItems(finalItems);

    if (user && rememberChoices) {
      await Promise.all(
        Object.entries(answers).map(([taxonomyEntryId, subtypeId]) => setPreference(user.email, taxonomyEntryId, subtypeId)),
      );
    }
    for (const [taxonomyEntryId, subtypeId] of Object.entries(answers)) {
      perfLog('planner:ambiguity-resolved', { taxonomyEntryId, subtypeId, remembered: rememberChoices });
    }

    await runOptimization(finalItems);
  };

  const handleStartShopping = useCallback(async (candidate: PlanCandidate) => {
    const cartItems: CartItem[] = candidate.storeAssignments.flatMap(assignment =>
      assignment.items
        .filter(line => line.product)
        .map(line => ({ product: line.product!, quantity: 1 })),
    );
    await setCart(cartItems);
    router.push('/route');
  }, [setCart, router]);

  const allAnswered = useMemo(() => prompts.every(p => p.taxonomyEntryId in answers), [prompts, answers]);

  return (
    <main className="min-h-screen bg-white flex flex-col">
      <AppHeader back={{ onClick: () => (step === 'input' ? router.push('/') : setStep('input')), title: 'Smart Shopping Planner' }} />

      <div className="max-w-2xl mx-auto w-full px-4 py-8 flex-1">
        {step === 'input' && (
          <form onSubmit={handleCreatePlan} className="space-y-4">
            <div>
              <h1 className="text-2xl font-extrabold text-[#1A1A1A] mb-1.5">What&apos;s on your list?</h1>
              <p className="text-[#1A1A1A]/55 text-sm">
                Enter your grocery list, one item per line — we&apos;ll find the best stores, route, and prices.
              </p>
            </div>
            <textarea
              autoFocus
              value={listText}
              onChange={e => setListText(e.target.value)}
              placeholder={'milk\neggs\nchicken\nbread\nbananas\nyogurt\ncereal'}
              rows={9}
              className="w-full border border-gray-100 rounded-2xl px-4 py-3.5 text-[#1A1A1A] placeholder-[#1A1A1A]/30 focus:outline-none focus:border-[#2C742F] focus:ring-2 focus:ring-[#2C742F]/15 transition-all text-sm resize-none"
            />
            {!zipcode && (
              <p className="text-amber-700 text-xs">Sign in and set your ZIP code in Profile to build a plan.</p>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-[#2C742F] hover:bg-[#255f27] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-md"
            >
              Create My Plan
            </button>
          </form>
        )}

        {step === 'clarify' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-xl font-extrabold text-[#1A1A1A] mb-1.5">Quick question</h1>
              <p className="text-[#1A1A1A]/55 text-sm">
                A couple of items could mean a few things — pick what you want, or leave it up to us.
              </p>
            </div>

            <div className="space-y-3">
              {prompts.map(prompt => (
                <AmbiguityCard
                  key={prompt.taxonomyEntryId}
                  prompt={prompt}
                  selected={answers[prompt.taxonomyEntryId] ?? null}
                  onChange={value => setAnswers(a => ({ ...a, [prompt.taxonomyEntryId]: value }))}
                />
              ))}
            </div>

            <label className="flex items-center gap-2 text-[#1A1A1A]/60 text-xs">
              <input
                type="checkbox"
                checked={rememberChoices}
                onChange={e => setRememberChoices(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#2C742F]"
              />
              Remember my choices for next time
            </label>

            <button
              type="button"
              disabled={!allAnswered}
              onClick={handleContinueFromClarify}
              className="w-full bg-[#2C742F] hover:bg-[#255f27] disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-md"
            >
              Continue
            </button>
          </div>
        )}

        {step === 'loading' && (
          <div>
            <SearchProgress />
            <p className="text-center text-[#1A1A1A]/40 text-xs -mt-6">Building your optimized plan…</p>
          </div>
        )}

        {step === 'error' && (
          <div className="text-center py-16">
            <p className="text-red-600 text-sm mb-4">{errorMessage}</p>
            <button
              type="button"
              onClick={() => setStep('input')}
              className="text-[#2C742F] text-sm font-semibold underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        )}

        {step === 'results' && plan && (
          <PlanResultsView
            candidates={plan.candidates}
            recommendedId={plan.recommendedId}
            unresolvedItems={plan.unresolvedItems}
            onStartShopping={handleStartShopping}
          />
        )}
      </div>
    </main>
  );
}
