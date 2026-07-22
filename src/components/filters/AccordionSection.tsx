'use client';

import { useState } from 'react';

interface Props {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

/** Generic collapsible section used by every group in the Filter & Sort
 * panel — web port of shopsmart_mobile's AccordionSection, using a CSS
 * grid-rows transition (0fr → 1fr) instead of a measured-height Reanimated
 * value, since the browser can animate an intrinsic-height row natively. */
export default function AccordionSection({ title, defaultExpanded = false, children }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-gray-100">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between py-4"
      >
        <span className="text-[#1A1A1A] font-semibold text-[15px]">{title}</span>
        <svg
          className={`w-[18px] h-[18px] text-[#1A1A1A]/60 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
