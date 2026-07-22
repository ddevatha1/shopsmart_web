'use client';

import { useState } from 'react';
import type { ApiProduct } from '@/types';
import { buildStoreSectionsFromProducts } from '@/services/comparisonService';
import type { Coordinates } from '@/services/locationService';
import StoreSection from '@/components/comparison/StoreSection';

export interface CategoryChip {
  key: string;
  /** Already short — see comparisonService.shortenSiblingLabel — never a
   * full product name ("Kroger Fuji Apples - 3 Pound Bag"). */
  label: string;
  /** Jumps straight to that category/product — a sibling ProductGroup
   * (Compare) or a tangential related product (Product Detail). The chip
   * itself is the action; there's no intermediate reveal step anymore. */
  onPress: () => void;
}

interface Props {
  userCoords: Coordinates | null;
  categoryChips: CategoryChip[];
  browseProducts: ApiProduct[];
  onPressProduct: (product: ApiProduct) => void;
  onAddToCart: (product: ApiProduct) => void;
  onSearchMore: (query: string) => void;
}

const VISIBLE_CHIP_LIMIT = 3;

/**
 * "Still can't find it?" — one small, quiet card at the bottom of every
 * search layer, in the same spirit as Google's "People also search for" or
 * Amazon's "Did you mean": easy to ignore, immediately useful if needed,
 * never competing with the comparison results above it for attention.
 * Direct port of shopsmart_mobile's RefinementSection.
 */
export default function RefinementSection({
  userCoords, categoryChips, browseProducts, onPressProduct, onAddToCart, onSearchMore,
}: Props) {
  const [chipsExpanded, setChipsExpanded] = useState(false);
  const [browseExpanded, setBrowseExpanded] = useState(false);
  const [draftQuery, setDraftQuery] = useState('');

  const visibleChips = chipsExpanded ? categoryChips : categoryChips.slice(0, VISIBLE_CHIP_LIMIT);
  const hiddenCount = categoryChips.length - VISIBLE_CHIP_LIMIT;

  const browseSections = browseExpanded ? buildStoreSectionsFromProducts(browseProducts, userCoords) : [];

  const handleSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = draftQuery.trim();
    if (!trimmed) return;
    onSearchMore(trimmed);
    setDraftQuery('');
  };

  if (categoryChips.length === 0 && browseProducts.length === 0) return null;

  return (
    <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-4 flex flex-col gap-3">
      <p className="text-[#1A1A1A]/50 text-xs font-medium uppercase tracking-wide">Still can&apos;t find it?</p>

      {categoryChips.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[#1A1A1A]/40 text-[11.5px]">Related categories</p>
          <div className="flex flex-wrap gap-1.5">
            {visibleChips.map(chip => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onPress}
                className="border border-gray-100 rounded-full px-3 py-1 text-xs text-[#1A1A1A] hover:border-[#2C742F] hover:text-[#2C742F] transition-colors"
              >
                {chip.label}
              </button>
            ))}
            {!chipsExpanded && hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setChipsExpanded(true)}
                className="border border-gray-100 rounded-full px-3 py-1 text-xs text-[#1A1A1A] hover:border-[#2C742F] hover:text-[#2C742F] transition-colors"
              >
                +{hiddenCount}
              </button>
            )}
          </div>
        </div>
      )}

      {browseProducts.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setBrowseExpanded(v => !v)}
            className="flex items-center gap-1.5 text-[#2C742F] text-xs font-semibold hover:text-[#255f27] transition-colors self-start"
          >
            {browseExpanded ? 'Hide store listings' : 'Browse all store products'}
            {browseExpanded ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            )}
          </button>
          {browseExpanded && (
            <div className="mt-2">
              {browseSections.map(section => (
                <StoreSection
                  key={section.store}
                  section={section}
                  onPressListing={listing => onPressProduct(listing.product)}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmitSearch}>
        <input
          type="text"
          value={draftQuery}
          onChange={e => setDraftQuery(e.target.value)}
          placeholder="Try a more specific search..."
          className="w-full border border-gray-100 rounded-xl px-3.5 py-2.5 text-[13px] text-[#1A1A1A] placeholder-[#1A1A1A]/35 focus:outline-none focus:border-[#2C742F] transition-colors"
        />
      </form>
    </div>
  );
}
