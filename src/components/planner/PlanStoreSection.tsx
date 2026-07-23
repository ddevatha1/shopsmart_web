'use client';

import { useState } from 'react';
import type { PlanStoreAssignment } from '@/types';
import { storeAccents } from '@/theme/colors';

interface Props {
  index: number;
  assignment: PlanStoreAssignment;
}

/** One store's card within the plan results — collapsed to name/count/
 * subtotal by default (progressive disclosure), expandable to the full
 * item list. Visual pattern mirrors route/page.tsx's StopCard. */
export default function PlanStoreSection({ index, assignment }: Props) {
  const [expanded, setExpanded] = useState(false);
  const accent = storeAccents[assignment.store];

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-xs"
          style={{ backgroundColor: accent.dot }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#1A1A1A] font-bold text-sm">{assignment.location.name}</p>
          <p className="text-[#1A1A1A]/50 text-xs mt-0.5">
            {assignment.items.length} item{assignment.items.length !== 1 ? 's' : ''}
          </p>
        </div>
        <span className="text-[#1A1A1A] font-extrabold text-sm shrink-0">${assignment.subtotal.toFixed(2)}</span>
        <svg
          className={`w-4 h-4 text-[#1A1A1A]/40 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-3.5 space-y-2 border-t border-gray-50 pt-3">
          {assignment.items.map(line => (
            <div key={line.listItemId} className="flex items-center justify-between gap-2">
              <span className="text-[#1A1A1A]/75 text-[13px] truncate">{line.product?.name ?? line.rawText}</span>
              <span className="text-[#1A1A1A]/60 text-[13px] font-medium shrink-0">
                ${line.product?.price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
