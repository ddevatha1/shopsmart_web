'use client';

import { useState } from 'react';
import type { PlanCandidate, PlanCandidateId, PlanLineItem } from '@/types';
import PlanStoreSection from '@/components/planner/PlanStoreSection';

interface Props {
  candidates: PlanCandidate[];
  recommendedId: PlanCandidateId;
  unresolvedItems: PlanLineItem[];
  onStartShopping: (candidate: PlanCandidate) => void;
}

function formatMinutes(minutes: number): string {
  if (minutes < 1) return '<1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** The results screen: a tab per candidate plan (Balanced first/default,
 * per "Recommended Plan (default)"), a concise totals block up front, and
 * store sections with progressive disclosure (PlanStoreSection) below —
 * "advanced information... hidden behind expandable sections," per the
 * simplicity requirement. */
export default function PlanResultsView({ candidates, recommendedId, unresolvedItems, onStartShopping }: Props) {
  const [activeId, setActiveId] = useState<PlanCandidateId>(recommendedId);
  const active = candidates.find(c => c.id === activeId) ?? candidates[0];
  const [showReasoning, setShowReasoning] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {candidates.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveId(c.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold transition-colors ${
              c.id === activeId
                ? 'bg-[#2C742F] text-white'
                : 'bg-gray-100 text-[#1A1A1A]/60 hover:bg-gray-200'
            }`}
          >
            {c.label}
            {c.id === recommendedId ? ' ✓' : ''}
          </button>
        ))}
      </div>

      <div className="bg-[#E0F3E2] rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat value={`$${active.totalCost.toFixed(2)}`} label="Estimated Cost" />
        <Stat value={active.estimatedSavings > 0 ? `$${active.estimatedSavings.toFixed(2)}` : '—'} label="Est. Savings" />
        <Stat value={formatMinutes(active.totalDriveMinutes)} label="Drive Time" />
        <Stat value={`${active.storeCount} store${active.storeCount !== 1 ? 's' : ''}`} label="Stops" />
      </div>

      {active.itemsFound < active.itemsTotal && (
        <p className="text-amber-700 text-xs bg-amber-50 rounded-xl px-3.5 py-2.5">
          Found {active.itemsFound} of {active.itemsTotal} items for this plan.
        </p>
      )}

      <div className="space-y-2.5">
        <h3 className="text-[#1A1A1A] font-bold text-sm">Recommended Route</h3>
        {active.storeAssignments.map((assignment, i) => (
          <PlanStoreSection key={`${assignment.store}-${assignment.location.address}`} index={i} assignment={assignment} />
        ))}
      </div>

      {unresolvedItems.length > 0 && (
        <div className="bg-amber-50 rounded-2xl p-4">
          <p className="text-amber-900 font-semibold text-sm mb-2">
            {unresolvedItems.length} item{unresolvedItems.length !== 1 ? 's' : ''} not found
          </p>
          <div className="space-y-1.5">
            {unresolvedItems.map(item => (
              <div key={item.listItemId} className="text-amber-800 text-xs">
                <span className="font-medium">{item.rawText}</span>
                {item.alternativeSuggestion && (
                  <span> — try &ldquo;{item.alternativeSuggestion.name}&rdquo; instead?</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowReasoning(s => !s)}
        className="text-[#2C742F] text-xs font-medium underline underline-offset-2"
      >
        {showReasoning ? 'Hide' : 'Show'} price breakdown &amp; estimated gas cost
      </button>
      {showReasoning && (
        <div className="bg-gray-50 rounded-2xl p-4 space-y-1.5 text-xs text-[#1A1A1A]/70">
          <p>Groceries: ${active.totalCost.toFixed(2)}</p>
          <p>Est. gas cost (approximate, based on drive distance): ${active.estimatedGasCost.toFixed(2)}</p>
          <p>Total drive distance: {active.totalDriveMiles.toFixed(1)} mi</p>
          <p className="text-[#1A1A1A]/45 pt-1">
            This plan is based on price, drive distance, and drive time. Store hours and reliability
            aren&apos;t factored in yet.
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => onStartShopping(active)}
        className="w-full bg-[#2C742F] hover:bg-[#255f27] text-white font-bold py-3.5 rounded-xl transition-colors text-sm shadow-md"
      >
        Start Shopping
      </button>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[#2C742F] font-extrabold text-lg">{value}</p>
      <p className="text-[#2C742F]/70 text-[11px] mt-0.5">{label}</p>
    </div>
  );
}
