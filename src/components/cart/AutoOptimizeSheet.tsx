'use client';

import { useState } from 'react';
import { SearchProgress } from '@/components/search/SearchProgress';
import PlanStoreSection from '@/components/planner/PlanStoreSection';
import { generateShoppingPlan, PlannerApiError } from '@/services/plannerService';
import { useCartStore } from '@/store/cartStore';
import { everyLineMatchesOriginal } from '@/services/planValidation';
import type { CartItem, PlanCandidate, StoreGroup } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  groups: StoreGroup[];
  zipcode: string;
  /** Real driving minutes for the CURRENT cart's stores, when CartDrawer has
   * already resolved one — reused rather than re-fetched, same trip preview
   * the Multi-Stop Trip Estimate panel already draws on. */
  currentTripMinutes: number | null;
}

type Stage = 'idle' | 'loading' | 'result' | 'already-optimal' | 'error' | 'applied';

const MEANINGFUL_SAVINGS_THRESHOLD = 0.5;

function currentCost(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/**
 * Cart's "Auto-Optimize" — turns a previously vague, inert insight into a
 * concrete, one-click, reversible action. Reuses the same real optimizer
 * the Smart Shopping Planner already calls (generateShoppingPlan ->
 * /api/planner, which brute-forces every store subset and picks a scored
 * "recommended" candidate) rather than a second, parallel optimizer — the
 * cart's current items are simply sent through the identical pipeline
 * PlannerPage already uses, so "after" is always a real, fully-priced,
 * fully-routed plan, never an estimate.
 *
 * Direct port of shopsmart_mobile's AutoOptimizeSheet (a React Native
 * bottom-sheet Modal), reimplemented as a centered dialog matching this
 * app's own modal convention (see OnboardingOverlay) rather than a literal
 * port of RN `<Modal>`/`StyleSheet` markup — CartDrawer here is a slide-over
 * drawer, not a bottom sheet, so this opens as an overlay on top of it.
 */
export function AutoOptimizeSheet({ isOpen, onClose, items, groups, zipcode, currentTripMinutes }: Props) {
  const applyOptimizedItems = useCartStore((s) => s.applyOptimizedItems);
  const undoLastOptimization = useCartStore((s) => s.undoLastOptimization);

  const [stage, setStage] = useState<Stage>('idle');
  const [recommended, setRecommended] = useState<PlanCandidate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const before = { storeCount: groups.length, cost: currentCost(items) };

  const reset = () => {
    setStage('idle');
    setRecommended(null);
    setErrorMessage(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleAutoOptimize = async () => {
    setStage('loading');
    try {
      const plannerItems = items.map((i) => ({ id: i.product.id, rawText: i.product.name }));
      const plan = await generateShoppingPlan(plannerItems, zipcode);
      const candidate = plan.candidates.find((c) => c.id === plan.recommendedId) ?? plan.candidates[0];
      if (!candidate) {
        setErrorMessage("Couldn't find a plan for the items in your cart.");
        setStage('error');
        return;
      }
      if (!everyLineMatchesOriginal(candidate, items)) {
        // A resolved substitution landed in a different grocery department
        // than the item it's replacing — never show or let the shopper
        // apply a plan we can't verify is actually the same kind of item.
        setErrorMessage("Couldn't verify a reliable optimized plan for this cart's exact items — try again, or optimize with the Smart Shopping Planner instead.");
        setStage('error');
        return;
      }
      setRecommended(candidate);
      const savings = before.cost - candidate.totalCost;
      const fewerStops = before.storeCount - candidate.storeCount;
      setStage(savings < MEANINGFUL_SAVINGS_THRESHOLD && fewerStops <= 0 ? 'already-optimal' : 'result');
    } catch (err) {
      setErrorMessage(err instanceof PlannerApiError ? err.message : "Couldn't build an optimized plan.");
      setStage('error');
    }
  };

  const handleApply = async () => {
    if (!recommended) return;
    const cartItems: CartItem[] = recommended.storeAssignments.flatMap((assignment) =>
      assignment.items.filter((line) => line.product).map((line) => ({ product: line.product!, quantity: 1 })),
    );
    await applyOptimizedItems(cartItems);
    setStage('applied');
  };

  const handleUndo = async () => {
    await undoLastOptimization();
    handleClose();
  };

  if (!isOpen) return null;

  const savings = recommended ? before.cost - recommended.totalCost : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Auto-Optimize your cart"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        aria-hidden="true"
        onClick={stage === 'loading' ? undefined : handleClose}
      />

      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[88vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <h2 className="text-[#1A1A1A] font-bold text-lg">Auto-Optimize</h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4 text-[#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">
          {stage === 'idle' && (
            <div className="flex flex-col gap-5">
              <p className="text-[#1A1A1A]/55 text-[13.5px] text-center">
                We&apos;ll balance savings, number of stops, and travel to find the best version of this exact cart.
              </p>
              <div className="bg-gray-50 rounded-2xl p-5">
                <p className="text-[#1A1A1A] font-bold text-[13px] mb-3">Current Plan</p>
                <StatRow stores={before.storeCount} cost={before.cost} minutes={currentTripMinutes} />
              </div>
              <button
                type="button"
                onClick={handleAutoOptimize}
                className="w-full flex items-center justify-center gap-2 bg-[#2C742F] hover:bg-[#255f27] text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                Auto-Optimize
              </button>
            </div>
          )}

          {stage === 'loading' && (
            <div>
              <SearchProgress />
              <p className="text-center text-[#1A1A1A]/40 text-xs -mt-8">Finding your best plan…</p>
            </div>
          )}

          {stage === 'error' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
              <p className="text-red-500 text-[13.5px]">{errorMessage}</p>
              <button type="button" onClick={reset} className="text-[#2C742F] font-semibold text-sm underline">
                Try again
              </button>
            </div>
          )}

          {stage === 'already-optimal' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <svg className="w-9 h-9 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[#1A1A1A] font-bold text-base">Your cart is already well optimized.</p>
              <p className="text-[#1A1A1A]/55 text-[13.5px]">We couldn&apos;t find a meaningfully better balance of price and stops.</p>
              <button
                type="button"
                onClick={handleClose}
                className="bg-[#E0F3E2] text-[#2C742F] font-semibold py-3 px-6 rounded-xl text-sm"
              >
                Close
              </button>
            </div>
          )}

          {stage === 'result' && recommended && (
            <div className="flex flex-col gap-5">
              <p className="text-[#1A1A1A] font-bold text-[17px] text-center">
                {savings >= MEANINGFUL_SAVINGS_THRESHOLD
                  ? `Save $${savings.toFixed(2)}${recommended.storeCount < before.storeCount ? ` while reducing your trip to ${recommended.storeCount} store${recommended.storeCount !== 1 ? 's' : ''}` : ''}`
                  : `Reduce your trip to ${recommended.storeCount} store${recommended.storeCount !== 1 ? 's' : ''}`}
              </p>

              <div className="flex items-center justify-around bg-gray-50 rounded-2xl p-5">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[#1A1A1A]/50 text-[11px] font-semibold uppercase tracking-wide">Before</span>
                  <span className="text-[#1A1A1A] font-bold text-sm">{before.storeCount} store{before.storeCount !== 1 ? 's' : ''}</span>
                  <span className="text-[#1A1A1A] font-bold text-base">${before.cost.toFixed(2)}</span>
                </div>
                <svg className="w-5 h-5 text-[#1A1A1A]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[#1A1A1A]/50 text-[11px] font-semibold uppercase tracking-wide">After</span>
                  <span className="text-[#2C742F] font-bold text-sm">{recommended.storeCount} store{recommended.storeCount !== 1 ? 's' : ''}</span>
                  <span className="text-[#2C742F] font-bold text-base">${recommended.totalCost.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[#1A1A1A] font-bold text-sm">Optimized Route</p>
                {recommended.storeAssignments.map((assignment, i) => (
                  <PlanStoreSection key={`${assignment.store}-${assignment.location.address}`} index={i} assignment={assignment} />
                ))}
              </div>

              <button
                type="button"
                onClick={handleApply}
                className="w-full bg-[#2C742F] hover:bg-[#255f27] text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
              >
                Apply Plan
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-[#E0F3E2] text-[#2C742F] font-semibold py-3.5 rounded-xl transition-colors text-sm"
              >
                Keep Current Cart
              </button>
            </div>
          )}

          {stage === 'applied' && (
            <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
              <svg className="w-9 h-9 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-[#1A1A1A] font-bold text-base">Plan applied to your cart.</p>
              <p className="text-[#1A1A1A]/55 text-[13.5px]">Changed your mind? You can undo this instantly.</p>
              <button
                type="button"
                onClick={handleUndo}
                className="w-full flex items-center justify-center gap-2 bg-[#E0F3E2] text-[#2C742F] font-semibold py-3 rounded-xl text-sm"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
                </svg>
                Undo
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="w-full bg-[#2C742F] hover:bg-[#255f27] text-white font-semibold py-3 rounded-xl text-sm"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatRow({ stores, cost, minutes }: { stores: number; cost: number; minutes: number | null }) {
  return (
    <div className="flex items-center justify-around">
      <Stat value={`${stores}`} label={`store${stores !== 1 ? 's' : ''}`} />
      <Stat value={`$${cost.toFixed(2)}`} label="est. cost" />
      <Stat value={minutes != null ? formatMinutes(minutes) : '—'} label="est. travel" />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-[#1A1A1A] font-extrabold text-[17px]">{value}</span>
      <span className="text-[#1A1A1A]/50 text-[11px] mt-0.5">{label}</span>
    </div>
  );
}
