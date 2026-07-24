'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ApiProduct, STORE_NAMES, UNAVAILABLE_STORES } from '@/types';
import ProductCard from '@/components/ProductCard';
import ProductGroupCard from '@/components/ProductGroupCard';
import AppHeader from '@/components/AppHeader';
import StoreModeBar from '@/components/search/StoreModeBar';
import StorePickerSheet from '@/components/search/StorePickerSheet';
import RefinementSection, { type CategoryChip } from '@/components/search/RefinementSection';
import DidYouMeanBanner from '@/components/search/DidYouMeanBanner';
import { SearchProgress } from '@/components/search/SearchProgress';
import { ComparisonView } from '@/components/comparison/ComparisonView';
import { ContextualHint } from '@/components/onboarding/ContextualHint';
import { useUserStore } from '@/store/userStore';
import { useCartStore } from '@/store/cartStore';
import { useSearchStore } from '@/store/searchStore';
import { useStoreModeStore } from '@/store/storeModeStore';
import {
  buildProductGroups,
  buildCombinedGroup,
  categoryLayerIsMeaningful,
  countMeaningfulCategories,
  logCategoryAssignment,
  shortenSiblingLabel,
  type ProductGroup,
} from '@/services/comparisonService';
import { getCurrentCoordinates, type Coordinates } from '@/services/locationService';
import { validateSearchQuery } from '@/utils/searchValidation';
import { storeAccents } from '@/theme/colors';
import { perfLog } from '@/utils/perfLog';

const POPULAR = ['Organic Milk', 'Avocados', 'Chicken Breast', 'Almond Butter', 'Sourdough Bread'];
// Shown once, only to a visitor who has genuinely never searched before
// (see `recentSearches.length === 0` below) — "let the user perform the
// main action" rather than explain it, per the onboarding system's "teach
// only what's needed right now" principle.
const FIRST_SEARCH_SUGGESTIONS = ['Milk', 'Eggs', 'Chicken'];

// ─── Sub-components ────────────────────────────────────────────────────────────

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="max-w-lg mx-auto py-16">
      <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-[#1A1A1A] font-bold text-lg mb-2">Could not reach store data</h3>
        <p className="text-[#1A1A1A]/55 text-sm mb-6">{message}</p>

        <div className="text-left bg-white border border-red-100 rounded-2xl p-5 space-y-3">
          <p className="text-[#1A1A1A] text-sm font-semibold mb-1">Things you can try:</p>
          {[
            'Verify your local ZIP code is correct',
            'Check your local internet connectivity',
            'Try again in a few moments',
            'Search for a more common grocery item (e.g. "milk" or "eggs")',
          ].map(tip => (
            <div key={tip} className="flex items-start gap-2.5">
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <p className="text-[#1A1A1A]/65 text-sm">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  // ── Global state (zustand stores, ported 1:1 from shopsmart_mobile) ───────
  const user = useUserStore(s => s.user);
  const addToCart = useCartStore(s => s.addToCart);

  const { hasSearched, loading, error, activeQuery, activeZip, products, correction, search } = useSearchStore();
  const selectedStore = useStoreModeStore(s => s.selectedStore);
  const setSelectedStore = useStoreModeStore(s => s.setSelectedStore);

  // ── Local UI state ──────────────────────────────────────────────────────────
  const [query, setQuery] = useState('');
  const [invalidQueryMessage, setInvalidQueryMessage] = useState<string | null>(null);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getCurrentCoordinates().then(c => {
      if (!cancelled) setCoords(c);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const zipcode = user?.zipcode ?? '';
  const recentSearches = useMemo(
    () => [...(user?.searchHistory ?? [])].reverse().slice(0, 6),
    [user?.searchHistory],
  );

  const canSubmit = query.trim().length > 0 && zipcode.length === 5;

  // Stage 1 shows every direct match, unfiltered, grouped into semantic
  // product categories (see comparisonService.buildProductGroups). Stage 2
  // (related — the query as an ingredient/flavor/component) lives in its
  // own toggleable section within RefinementSection.
  const direct = useMemo(() => products.filter(p => p.matchType !== 'related'), [products]);
  const related = useMemo(() => products.filter(p => p.matchType === 'related'), [products]);
  const singleStoreProducts = useMemo(
    () => (selectedStore ? products.filter(p => p.store === selectedStore) : []),
    [products, selectedStore],
  );
  const groups = useMemo(() => buildProductGroups(direct, activeQuery), [direct, activeQuery]);
  const multiStoreGroups = useMemo(() => groups.filter(g => g.storeCount > 1), [groups]);
  const singleStoreGroups = useMemo(() => groups.filter(g => g.storeCount === 1), [groups]);

  const categoryChips: CategoryChip[] = useMemo(
    () => [
      ...singleStoreGroups.map(g => ({
        key: g.id,
        label: shortenSiblingLabel(g.name, activeQuery),
        onPress: () => router.push(`/compare/${encodeURIComponent(g.id)}`),
      })),
      ...related.map(p => ({
        key: p.id,
        label: shortenSiblingLabel(p.name, activeQuery, p.brand),
        onPress: () => router.push(`/product/${encodeURIComponent(p.id)}`),
      })),
    ],
    [singleStoreGroups, related, activeQuery, router],
  );

  const runSearch = useCallback((term: string) => {
    setQuery(term);
    search(term);
  }, [search]);

  // The "Did you mean" banner's escape hatch — re-runs the search using
  // exactly what the shopper typed, skipping correction entirely rather
  // than risking another (possibly different) auto-correction of the same
  // literal text.
  const searchOriginal = useCallback((original: string) => {
    setQuery(original);
    search(original, { noCorrect: true });
  }, [search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const trimmed = query.trim();
    const validation = validateSearchQuery(trimmed);
    if (!validation.valid) {
      setInvalidQueryMessage(validation.message);
      return;
    }
    setInvalidQueryMessage(null);
    search(trimmed);
  };

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (invalidQueryMessage) setInvalidQueryMessage(null);
  };

  const singleStoreMode = selectedStore != null;
  // The category grid (Stage 1) is only worth the extra click when there
  // are at least MIN_MEANINGFUL_CATEGORIES real, distinct, non-empty
  // multi-store categories (see comparisonService.categoryLayerIsMeaningful)
  // — otherwise route straight into the exact same Product Comparison View
  // a category normally opens into, just fed every direct-match product
  // instead of one cluster's listings (buildCombinedGroup). Never applies
  // in "Search Within One Store" mode, which already skips the category
  // layer entirely on its own terms.
  const categoryLayerWorthShowing = categoryLayerIsMeaningful(multiStoreGroups);
  // TODO(temporary debug logging): remove once the category-skip bug fix
  // has been verified in the field — see the categoryLayerIsMeaningful
  // investigation. Logs the raw group count, how many survive the
  // dedupe/empty/placeholder filter, and which layer this search lands on.
  useEffect(() => {
    if (!hasSearched) return;
    console.log('[CategoryLayer]', {
      query: activeQuery,
      rawGroups: groups.length,
      rawMultiStoreGroups: multiStoreGroups.length,
      uniqueMeaningfulCategories: countMeaningfulCategories(multiStoreGroups),
      decision: categoryLayerWorthShowing ? 'show-category-layer' : 'skip-to-comparison',
    });
    // Per-store category-assignment funnel — see comparisonService's
    // logCategoryAssignment for what this catches (the "global search
    // shows 0 Kroger products in a category the Kroger-only search
    // clearly has matches for" bug).
    logCategoryAssignment(direct, groups, activeQuery);
  }, [hasSearched, activeQuery, groups, multiStoreGroups, categoryLayerWorthShowing, direct]);
  const bypassToComparison = hasSearched && !loading && !error
    && !singleStoreMode && direct.length > 0 && !categoryLayerWorthShowing;
  const combinedGroup = useMemo(
    () => (bypassToComparison ? buildCombinedGroup(direct, activeQuery) : null),
    [bypassToComparison, direct, activeQuery],
  );
  const displayedItems: (ProductGroup | ApiProduct)[] = singleStoreMode ? singleStoreProducts : multiStoreGroups;

  // Closes the "UI rendering" gap in the first-search timing breakdown —
  // pairs with search:client-complete (network+server) to show how much of
  // the perceived wait is actually paint, not fetch. Double rAF: the first
  // callback only guarantees a new frame has been scheduled, not that this
  // render's DOM changes have been committed to it yet; the second one does.
  useEffect(() => {
    if (!hasSearched || loading) return;
    const start = performance.now();
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        perfLog('search:ui-render', { query: activeQuery, ms: Math.round(performance.now() - start) });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [hasSearched, loading, activeQuery]);

  const chipTerms = recentSearches.length > 0 ? recentSearches : POPULAR;
  const chipLabel = recentSearches.length > 0 ? 'Recent:' : 'Popular:';

  return (
    <main className="min-h-screen bg-white">
      <AppHeader />

      {/* ── Hero search section ──────────────────────────────────────────────── */}
      <section className="bg-[#E0F3E2]">
        <div className="max-w-4xl mx-auto px-4 py-14 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1A1A1A] tracking-tight mb-3">
            Compare grocery prices, instantly
          </h1>
          <p className="text-[#1A1A1A]/60 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Search Trader Joe&apos;s, Sprouts, Kroger &amp; Aldi near you.
          </p>

          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 text-left"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder="e.g. Organic Oat Milk"
                className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3 text-[#1A1A1A] placeholder-[#1A1A1A]/35 focus:outline-none focus:border-[#2C742F] focus:ring-2 focus:ring-[#2C742F]/15 transition-all text-sm"
              />
              <button
                type="submit"
                disabled={!canSubmit || loading}
                className="bg-[#2C742F] hover:bg-[#255f27] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap text-sm"
              >
                {loading ? 'Searching…' : selectedStore ? `Search ${selectedStore}` : 'Search All Stores'}
              </button>
            </div>

            <div className="mt-3">
              <StoreModeBar
                selectedStore={selectedStore}
                onOpenPicker={() => setPickerOpen(true)}
                onClear={() => setSelectedStore(null)}
              />
            </div>

            {!zipcode && (
              <p className="mt-2 text-amber-700 text-xs">
                Sign in and set your ZIP code in Profile to start searching.
              </p>
            )}
            {invalidQueryMessage && (
              <p className="mt-2 text-amber-700 text-xs">{invalidQueryMessage}</p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
              <span className="text-[#1A1A1A]/40 text-xs">{chipLabel}</span>
              {chipTerms.map(term => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setQuery(term)}
                  className="text-[#1A1A1A]/55 hover:text-[#2C742F] text-xs transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </form>
        </div>
      </section>

      {/* ── Smart Shopping Planner entry point ───────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 -mt-6">
        <button
          type="button"
          onClick={() => router.push('/planner')}
          className="w-full flex items-center gap-4 bg-white border border-gray-100 hover:border-[#2C742F]/30 rounded-2xl shadow-sm hover:shadow-md p-5 text-left transition-all"
        >
          <div className="w-11 h-11 rounded-full bg-[#E0F3E2] flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#1A1A1A] font-bold text-sm">Smart Shopping Planner</p>
            <p className="text-[#1A1A1A]/50 text-xs mt-0.5">Paste your whole grocery list — get the best route, stores, and prices, instantly.</p>
          </div>
          <svg className="w-4 h-4 text-[#1A1A1A]/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </section>

      {/* ── Dashboard body ───────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        {!hasSearched && (
          <div className="text-center py-16">
            <div className="flex justify-center gap-2 mb-4">
              {(selectedStore ? [selectedStore] : STORE_NAMES.filter(s => !UNAVAILABLE_STORES.has(s))).map(s => (
                <span key={s} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: storeAccents[s].dot }} />
              ))}
            </div>
            <p className="text-[#1A1A1A]/50 text-sm">
              {selectedStore
                ? `Enter a product above to browse ${selectedStore}'s inventory.`
                : 'Enter a product above to compare prices across nearby stores.'}
            </p>
            {recentSearches.length === 0 && (
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                <span className="text-[#1A1A1A]/50 text-xs font-semibold">Try searching:</span>
                {FIRST_SEARCH_SUGGESTIONS.map(term => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => runSearch(term)}
                    className="bg-[#E0F3E2] hover:bg-[#D0EBD2] text-[#2C742F] text-xs font-bold px-3.5 py-1.5 rounded-full transition-colors"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {hasSearched && loading && <SearchProgress />}

        {hasSearched && !loading && error && <ErrorPanel message={error} />}

        {hasSearched && !loading && !error && bypassToComparison && combinedGroup && (
          <div className="animate-results-fade-in">
            {correction && <DidYouMeanBanner correction={correction} onSearchOriginal={searchOriginal} />}
            {combinedGroup.listings.length > 0 && (
              <div className="max-w-5xl mx-auto px-4 pt-4">
                <ContextualHint hintKey="search-compare" message="ShopSmart compares prices across stores." />
              </div>
            )}
            <ComparisonView
              group={combinedGroup}
              allDirectProducts={direct}
              onPressProduct={p => router.push(`/product/${encodeURIComponent(p.id)}`)}
              onAddToCart={p => addToCart(p)}
              onOpenCategory={g => router.push(`/compare/${encodeURIComponent(g.id)}`)}
              onSearchMore={runSearch}
            />
          </div>
        )}

        {hasSearched && !loading && !error && !bypassToComparison && (
          <div className="animate-results-fade-in">
            {correction && <DidYouMeanBanner correction={correction} onSearchOriginal={searchOriginal} />}
            {displayedItems.length > 0 && (
              <div className="mb-6">
                <ContextualHint hintKey="search-compare" message="ShopSmart compares prices across stores." />
              </div>
            )}
            <div className="mb-6">
              <h2 className="text-xl font-bold text-[#1A1A1A]">
                {displayedItems.length}{' '}
                <span className="text-[#1A1A1A]/45 font-normal">
                  {singleStoreMode ? 'product' : 'categor'}{displayedItems.length !== 1 ? (singleStoreMode ? 's' : 'ies') : (singleStoreMode ? '' : 'y')} for
                </span>{' '}
                <span className="text-[#2C742F]">&ldquo;{activeQuery}&rdquo;</span>
              </h2>
              <p className="text-[#1A1A1A]/40 text-sm mt-0.5">
                near {activeZip}
                {selectedStore ? ` · shopping at ${selectedStore}` : ' · comparing across stores'}
              </p>
            </div>

            {displayedItems.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-[#1A1A1A]/50 text-base font-medium mb-1">
                  {selectedStore ? `No products found at ${selectedStore}` : 'No comparable products found'}
                </p>
                <p className="text-[#1A1A1A]/35 text-sm">
                  {products.length === 0
                    ? 'Try a different search term.'
                    : selectedStore
                      ? 'Try a different search term, or compare across stores instead.'
                      : 'Check the refinement options below.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {singleStoreMode
                  ? singleStoreProducts.map(product => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onAddToCart={p => addToCart(p)}
                        onClick={p => router.push(`/product/${encodeURIComponent(p.id)}`)}
                      />
                    ))
                  : multiStoreGroups.map(group => (
                      <ProductGroupCard
                        key={group.id}
                        group={group}
                        onClick={g => router.push(`/compare/${encodeURIComponent(g.id)}`)}
                      />
                    ))}
              </div>
            )}

            {!singleStoreMode && (
              <RefinementSection
                userCoords={coords}
                categoryChips={categoryChips}
                browseProducts={direct}
                onPressProduct={p => router.push(`/product/${encodeURIComponent(p.id)}`)}
                onAddToCart={p => addToCart(p)}
                onSearchMore={runSearch}
              />
            )}
          </div>
        )}
      </section>

      <StorePickerSheet
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={store => {
          setSelectedStore(store);
          setPickerOpen(false);
        }}
      />
    </main>
  );
}
