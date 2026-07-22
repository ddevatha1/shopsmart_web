'use client';

import { useEffect, useMemo, useState } from 'react';
import ProductCard from '@/components/ProductCard';
import StoreSection from './StoreSection';
import FilterTriggerButton from '@/components/filters/FilterTriggerButton';
import ComparisonFilterModal from './ComparisonFilterModal';
import RefinementSection, { type CategoryChip } from '@/components/search/RefinementSection';
import {
  enrichListings,
  buildStoreSections,
  buildProductGroups,
  shortenSiblingLabel,
  getBestValueSummary,
  applyComparisonFilters,
  defaultComparisonFilters,
  countActiveComparisonFilters,
  type ComparisonFilters,
  type EnrichedListing,
  type ProductGroup,
} from '@/services/comparisonService';
import { buildFilterSchema } from '@/services/filterSchemaService';
import { getCurrentCoordinates, type Coordinates } from '@/services/locationService';
import { useSearchStore } from '@/store/searchStore';
import type { ApiProduct } from '@/types';

interface Props {
  group: ProductGroup;
  /** The whole direct-match pool from the search that led here — every
   * variety, every store — carried along only for the "Still can't find
   * it?" card (see RefinementSection) and the sibling-categories lookup
   * below. */
  allDirectProducts: ApiProduct[];
  onPressProduct: (product: ApiProduct) => void;
  onAddToCart: (product: ApiProduct) => void;
  /** A sibling category chip was tapped — the caller decides how to get
   * there (the compare page navigates to that category's URL; the home
   * page's bypass mode does the same), since that differs by where this
   * view is mounted. */
  onOpenCategory: (group: ProductGroup) => void;
  onSearchMore: (term: string) => void;
}

/**
 * Stage 2's body — a single featured "Best Value" pick, then every store's
 * own horizontally-browsable row of every matching product it carries.
 * Deliberately just the *content*: no page chrome (header/back button) so
 * it can be mounted two ways — /compare/[groupId] wraps it as its own page
 * after a shopper taps a category, and the home page mounts it directly
 * under the search results header when the category layer isn't worth the
 * click (see comparisonService.categoryLayerIsMeaningful/
 * buildCombinedGroup) — same interface either way, never a third UI.
 */
export function ComparisonView({
  group, allDirectProducts, onPressProduct, onAddToCart, onOpenCategory, onSearchMore,
}: Props) {
  const activeQuery = useSearchStore(s => s.activeQuery);

  const [coords, setCoords] = useState<Coordinates | null>(null);
  useEffect(() => {
    let cancelled = false;
    getCurrentCoordinates().then(c => {
      if (!cancelled) setCoords(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<ComparisonFilters>(defaultComparisonFilters());
  const activeFilterCount = countActiveComparisonFilters(filters);

  const filterSchema = useMemo(() => buildFilterSchema(group.listings), [group.listings]);

  const siblingGroups = useMemo(
    () => buildProductGroups(allDirectProducts, activeQuery).filter(g => g.id !== group.id),
    [allDirectProducts, group.id, activeQuery],
  );
  const categoryChips: CategoryChip[] = useMemo(
    () => siblingGroups.map(g => ({
      key: g.id,
      label: shortenSiblingLabel(g.name, group.name),
      onPress: () => onOpenCategory(g),
    })),
    [siblingGroups, group.name, onOpenCategory],
  );

  const filteredGroup: ProductGroup = useMemo(
    () => ({ ...group, listings: applyComparisonFilters(group.listings, filters, filterSchema.attributes) }),
    [group, filters, filterSchema.attributes],
  );

  const allListings = useMemo(() => enrichListings(filteredGroup, coords), [filteredGroup, coords]);
  const bestValue = useMemo(() => getBestValueSummary(allListings), [allListings]);
  const storeSections = useMemo(
    () => buildStoreSections(filteredGroup, coords, filters.sort),
    [filteredGroup, coords, filters.sort],
  );

  const handlePressListing = (listing: EnrichedListing) => onPressProduct(listing.product);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <FilterTriggerButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
      </div>

      {bestValue && (
        <div className="flex flex-col items-center mb-8">
          <span className="self-start text-[#2C742F] text-[10.5px] font-bold uppercase tracking-wide mb-2.5">
            Best Value
          </span>
          <div className="w-full max-w-xs">
            <ProductCard
              product={bestValue.best.product}
              bestValue
              unitPriceLabel={bestValue.best.unitPrice?.label}
              savingsLabel={bestValue.savings != null ? `Save $${bestValue.savings.toFixed(2)}` : undefined}
              onClick={() => onPressProduct(bestValue.best.product)}
              onAddToCart={() => onAddToCart(bestValue.best.product)}
            />
          </div>
        </div>
      )}

      {storeSections.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-[#1A1A1A]/50 text-sm">No products match your filters — try adjusting them.</p>
        </div>
      ) : (
        storeSections.map(section => (
          <StoreSection
            key={section.store}
            section={section}
            onPressListing={handlePressListing}
            onAddToCart={onAddToCart}
          />
        ))
      )}

      <RefinementSection
        userCoords={coords}
        categoryChips={categoryChips}
        browseProducts={allDirectProducts}
        onPressProduct={onPressProduct}
        onAddToCart={onAddToCart}
        onSearchMore={onSearchMore}
      />

      <ComparisonFilterModal
        isOpen={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        sortOptions={filterSchema.sortOptions}
        sizeOptions={filterSchema.sizeOptions}
        attributeDefs={filterSchema.attributes}
        filters={filters}
        onApply={setFilters}
        onReset={() => setFilters(defaultComparisonFilters())}
      />
    </div>
  );
}
