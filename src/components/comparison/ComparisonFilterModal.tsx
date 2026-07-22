'use client';

import { useMemo, useState } from 'react';
import {
  countActiveComparisonFilters,
  type AttributeFilterDef,
  type ComparisonFilters,
  type ComparisonSort,
} from '@/services/comparisonService';
import AccordionSection from '@/components/filters/AccordionSection';
import ChipRow from '@/components/filters/ChipRow';
import FilterFooter from '@/components/filters/FilterFooter';

/** How many dynamically-generated attribute facets show up front, above
 * the "More Filters" fold — the rest (typically Brand/Store and secondary
 * boolean facets) collapse into an accordion so the sheet stays short for
 * categories with a long attribute list. */
const ALWAYS_VISIBLE_ATTRIBUTE_COUNT = 3;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sortOptions: { value: ComparisonSort; label: string }[];
  sizeOptions: string[];
  attributeDefs: AttributeFilterDef[];
  filters: ComparisonFilters;
  onApply: (filters: ComparisonFilters) => void;
  onReset: () => void;
}

/**
 * The comparison page's Filter & Sort sheet — direct port of
 * shopsmart_mobile's ComparisonFilterModal, as a right-side slide-over
 * panel (matching this app's existing Cart/Profile pattern) instead of a
 * bottom sheet. Every facet here is generated fresh per category by
 * filterSchemaService.buildFilterSchema; this component only renders
 * whatever schema it's handed.
 */
export default function ComparisonFilterModal({
  isOpen, onClose, sortOptions, sizeOptions, attributeDefs, filters, onApply, onReset,
}: Props) {
  const [draft, setDraft] = useState(filters);
  const activeCount = useMemo(() => countActiveComparisonFilters(draft), [draft]);

  // Reset the draft to the live filters every time the sheet opens, so a
  // previous unapplied edit never leaks into the next time it's opened.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen && !wasOpen) {
    setWasOpen(true);
    if (draft !== filters) setDraft(filters);
  } else if (!isOpen && wasOpen) {
    setWasOpen(false);
  }

  if (!isOpen) return null;

  const setSort = (value: string) => setDraft(prev => ({ ...prev, sort: value as ComparisonSort }));

  const toggleSize = (size: string) => {
    setDraft(prev => {
      const next = new Set(prev.sizes);
      if (next.has(size)) next.delete(size);
      else next.add(size);
      return { ...prev, sizes: next };
    });
  };

  const toggleInStock = () => setDraft(prev => ({ ...prev, inStockOnly: !prev.inStockOnly }));

  const toggleAttribute = (key: string, value: string) => {
    setDraft(prev => {
      const current = prev.attributes[key] ?? new Set<string>();
      const next = new Set(current);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, attributes: { ...prev.attributes, [key]: next } };
    });
  };

  const handleClear = () => {
    onReset();
    onClose();
  };

  const handleApply = () => {
    onApply(draft);
    onClose();
  };

  const visibleAttributes = attributeDefs.slice(0, ALWAYS_VISIBLE_ATTRIBUTE_COUNT);
  const moreAttributes = attributeDefs.slice(ALWAYS_VISIBLE_ATTRIBUTE_COUNT);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div className="relative bg-white w-full sm:w-[420px] h-full shadow-2xl flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <h2 className="text-lg font-bold text-[#1A1A1A]">Filter &amp; Sort</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            aria-label="Close filters"
          >
            <svg className="w-4 h-4 text-[#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6">
          <FilterGroup label="Sort By">
            <ChipRow options={sortOptions} selected={new Set([draft.sort])} onToggle={setSort} />
          </FilterGroup>

          {sizeOptions.length > 1 && (
            <FilterGroup label="Serving Size">
              <ChipRow
                options={sizeOptions.map(s => ({ value: s, label: s }))}
                selected={draft.sizes}
                onToggle={toggleSize}
              />
            </FilterGroup>
          )}

          <FilterGroup label="Availability">
            <ChipRow
              options={[{ value: 'yes', label: 'In Stock Only' }]}
              selected={draft.inStockOnly ? new Set(['yes']) : new Set()}
              onToggle={toggleInStock}
            />
          </FilterGroup>

          {visibleAttributes.map(def => (
            <FilterGroup key={def.key} label={def.label}>
              <ChipRow
                options={def.options}
                selected={draft.attributes[def.key] ?? new Set()}
                onToggle={value => toggleAttribute(def.key, value)}
              />
            </FilterGroup>
          ))}

          {moreAttributes.length > 0 && (
            <AccordionSection title="More Filters">
              <div className="flex flex-col gap-5 pb-4">
                {moreAttributes.map(def => (
                  <FilterGroup key={def.key} label={def.label} compact>
                    <ChipRow
                      options={def.options}
                      selected={draft.attributes[def.key] ?? new Set()}
                      onToggle={value => toggleAttribute(def.key, value)}
                    />
                  </FilterGroup>
                ))}
              </div>
            </AccordionSection>
          )}
        </div>

        <FilterFooter activeFilterCount={activeCount} onClear={handleClear} onApply={handleApply} />
      </div>
    </div>
  );
}

function FilterGroup({ label, children, compact }: { label: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={compact ? 'mb-5' : 'mb-7'}>
      <p className="text-[#1A1A1A]/60 text-[10.5px] font-bold uppercase tracking-wide mb-2.5">{label}</p>
      {children}
    </div>
  );
}
