'use client';

import { use, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import AppHeader from '@/components/AppHeader';
import { ComparisonView } from '@/components/comparison/ComparisonView';
import { buildProductGroups } from '@/services/comparisonService';
import { useCartStore } from '@/store/cartStore';
import { useSearchStore } from '@/store/searchStore';
import type { ApiProduct } from '@/types';

/**
 * Stage 2 page chrome — header (back button + category name) around
 * ComparisonView, which owns the actual hero/filter/store-section/
 * refinement content. Resolved against whatever the current browser
 * session's search store already holds (no separate fetch). A cold visit
 * with no prior search (e.g. a bookmarked/shared link, or a page refresh)
 * has nothing to resolve against, so it falls back to a "start a new
 * search" prompt rather than crashing.
 *
 * See ComparisonView for why the content itself is factored out: the home
 * page mounts the exact same component directly, without this header,
 * when a search's category layer isn't worth the click (see
 * comparisonService.categoryLayerIsMeaningful).
 */
export default function ComparePage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = use(params);
  const router = useRouter();
  const decodedGroupId = decodeURIComponent(groupId);

  const products = useSearchStore(s => s.products);
  const activeQuery = useSearchStore(s => s.activeQuery);
  const addToCart = useCartStore(s => s.addToCart);

  const direct = useMemo(() => products.filter(p => p.matchType !== 'related'), [products]);
  const allGroups = useMemo(() => buildProductGroups(direct, activeQuery), [direct, activeQuery]);
  const group = allGroups.find(g => g.id === decodedGroupId) ?? null;

  const openProduct = (product: ApiProduct) => {
    router.push(`/product/${encodeURIComponent(product.id)}`);
  };

  const runSearchMore = (term: string) => {
    useSearchStore.getState().search(term);
    router.push('/');
  };

  if (!group) {
    return (
      <main className="min-h-screen bg-white flex flex-col">
        <AppHeader back={{ onClick: () => router.push('/'), title: 'Compare' }} />
        <div className="flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-[#1A1A1A] font-bold text-lg mb-2">Nothing to compare yet</p>
          <p className="text-[#1A1A1A]/50 text-sm mb-6">
            This comparison link needs an active search first — start one below.
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="bg-[#2C742F] hover:bg-[#255f27] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Start a new search
          </button>
        </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <AppHeader back={{ onClick: () => router.back(), title: group.name }} />
      <ComparisonView
        group={group}
        allDirectProducts={direct}
        onPressProduct={openProduct}
        onAddToCart={product => addToCart(product)}
        onOpenCategory={g => router.push(`/compare/${encodeURIComponent(g.id)}`)}
        onSearchMore={runSearchMore}
      />
    </main>
  );
}
