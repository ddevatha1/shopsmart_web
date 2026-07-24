'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CartItem, ApiProduct, TripPlan } from '@/types';
import { categorizeProduct, GROCERY_CATEGORIES, type GroceryCategory } from '@/services/groceryCategoryService';
import { getCartSuggestions } from '@/services/cartSuggestionService';
import { getBudgetStatus } from '@/services/budgetService';
import { planShoppingTrip } from '@/services/tripService';
import { groupCartByStore, locationKey } from '@/utils/groupCartByStore';
import { useUserStore } from '@/store/userStore';
import { ContextualHint } from '@/components/onboarding/ContextualHint';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQty: (productId: string, qty: number) => void;
  onRemove: (productId: string) => void;
  zipcode: string;
}

const STORE_ACCENT: Record<ApiProduct['store'], string> = {
  "Trader Joe's": 'bg-rose-100 text-rose-700',
  Sprouts: 'bg-emerald-100 text-emerald-700',
  Kroger: 'bg-sky-100 text-sky-700',
  Aldi: 'bg-cyan-100 text-cyan-700',
  Albertsons: 'bg-violet-100 text-violet-700',
};

function formatMinutes(min: number): string {
  const rounded = Math.round(min);
  if (rounded < 60) return `~${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `~${h} hr` : `~${h} hr ${m} min`;
}

export default function CartDrawer({
  isOpen,
  onClose,
  items,
  onUpdateQty,
  onRemove,
  zipcode,
}: CartDrawerProps) {
  const router = useRouter();
  const user = useUserStore(s => s.user);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const uniqueStores = new Set(items.map(i => i.product.store));

  const byStore = Array.from(uniqueStores).map(store => ({
    store,
    items: items.filter(i => i.product.store === store),
    subtotal: items
      .filter(i => i.product.store === store)
      .reduce((s, i) => s + i.product.price * i.quantity, 0),
  }));

  // The checklist groups itself by grocery aisle (Produce, Dairy, Meat,
  // ...) via a real name-keyword classifier, not a manual control —
  // direct port of shopsmart_mobile's CartScreen sectioning.
  const sections = useMemo(() => {
    const byCategory = new Map<GroceryCategory, CartItem[]>();
    for (const item of items) {
      const category = categorizeProduct(item.product);
      const list = byCategory.get(category) ?? [];
      list.push(item);
      byCategory.set(category, list);
    }
    return GROCERY_CATEGORIES
      .filter(c => byCategory.has(c))
      .map(c => ({ title: c, items: byCategory.get(c)! }));
  }, [items]);

  const cartSuggestions = useMemo(() => getCartSuggestions(items), [items]);
  const budgetStatus = getBudgetStatus(user?.weeklyBudget, total);

  // Real, server-computed multi-stop trip time (replacing a synthetic
  // formula) — same grouping-by-physical-store the Route page uses, only
  // fetched once there are actually 2+ distinct stores to sequence.
  const { groups } = useMemo(() => groupCartByStore(items), [items]);
  const routeSignature = groups.map(g => locationKey(g.location)).sort().join(',');
  const [fetchedTrip, setFetchedTrip] = useState<TripPlan | null>(null);
  const fetchedSignature = useRef<string | null>(null);
  useEffect(() => {
    if (groups.length < 2) {
      fetchedSignature.current = null;
      return;
    }
    if (fetchedSignature.current === routeSignature) return;
    fetchedSignature.current = routeSignature;
    let cancelled = false;
    planShoppingTrip(groups.map(g => g.location), zipcode)
      .then(trip => {
        if (!cancelled) setFetchedTrip(trip);
      })
      .catch(() => {
        if (!cancelled) setFetchedTrip(null);
      });
    return () => {
      cancelled = true;
    };
  }, [groups, routeSignature, zipcode]);
  // A stale preview from a since-shrunk cart is never shown — the fetch
  // effect above only clears its own "already fetched" marker, not this
  // state directly (avoiding a synchronous setState-in-effect), so the
  // display-time gate lives here instead.
  const tripPreview = groups.length >= 2 ? fetchedTrip : null;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Cart"
        className={`fixed top-0 right-0 h-full z-40 w-full sm:w-[420px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h2 className="text-[#1A1A1A] font-bold text-lg">Your Cart</h2>
            {items.length > 0 && (
              <span className="bg-[#2C742F] text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {items.reduce((s, i) => s + i.quantity, 0)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            aria-label="Close cart"
          >
            <svg className="w-4 h-4 text-[#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
              <div className="w-20 h-20 bg-[#E0F3E2] rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-[#2C742F]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <p className="text-[#1A1A1A] font-semibold">Your cart is empty</p>
              <p className="text-[#1A1A1A]/45 text-sm">
                Search for groceries and click &ldquo;Add to Cart&rdquo; on any product.
              </p>
            </div>
          ) : (
            <div className="px-6 py-4">
              <div className="mb-3">
                <ContextualHint hintKey="cart" message="Add items to your list to find the smartest shopping plan." />
              </div>
              {cartSuggestions.length > 0 && (
                <p className="text-[#1A1A1A]/60 text-xs italic mb-3 px-1">
                  You may also need {cartSuggestions.join(' and ')}.
                </p>
              )}

              {sections.map(section => (
                <div key={section.title} className="mb-4 last:mb-0">
                  <p className="text-[#1A1A1A]/50 font-bold text-[11px] uppercase tracking-wide mb-2">
                    {section.title}
                  </p>
                  <div className="space-y-3">
                    {section.items.map(item => (
                      <div
                        key={item.product.id}
                        className="flex items-start gap-3 bg-gray-50 rounded-2xl p-3"
                      >
                        <div className="w-14 h-14 rounded-xl bg-white border border-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                          {item.product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product.image_url}
                              alt={item.product.name}
                              className="w-full h-full object-contain p-1"
                              onError={e => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <svg className="w-6 h-6 text-[#2C742F]/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-[#1A1A1A] text-xs font-semibold leading-snug line-clamp-2">
                            {item.product.name}
                          </p>
                          <span
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${STORE_ACCENT[item.product.store]}`}
                          >
                            {item.product.store}
                          </span>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              onClick={() =>
                                item.quantity > 1
                                  ? onUpdateQty(item.product.id, item.quantity - 1)
                                  : onRemove(item.product.id)
                              }
                              className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#1A1A1A]/70 hover:border-[#2C742F] hover:text-[#2C742F] transition-colors text-sm font-bold"
                              aria-label="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                            <button
                              onClick={() => onUpdateQty(item.product.id, item.quantity + 1)}
                              className="w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#1A1A1A]/70 hover:border-[#2C742F] hover:text-[#2C742F] transition-colors text-sm font-bold"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className="text-[#1A1A1A] font-bold text-sm">
                            ${(item.product.price * item.quantity).toFixed(2)}
                          </span>
                          <button
                            onClick={() => onRemove(item.product.id)}
                            className="text-[#1A1A1A]/30 hover:text-red-500 transition-colors"
                            aria-label={`Remove ${item.product.name}`}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-5 space-y-4 bg-white">
            <div className="bg-[#E0F3E2] rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[#2C742F] font-semibold text-sm">Multi-Stop Trip Estimate</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#1A1A1A]/60 text-xs">
                  {uniqueStores.size} store{uniqueStores.size !== 1 ? 's' : ''} near{' '}
                  {zipcode || 'your area'}
                </span>
                {tripPreview && (
                  <span className="text-[#2C742F] font-bold text-sm">
                    {formatMinutes(tripPreview.totalDurationMinutes)}
                  </span>
                )}
              </div>

              <div className="space-y-1 pt-1 border-t border-[#2C742F]/15">
                {byStore.map(({ store, items: storeItems, subtotal }) => (
                  <div key={store} className="flex items-center justify-between text-xs">
                    <span className="text-[#1A1A1A]/60">
                      {store} ({storeItems.reduce((s, i) => s + i.quantity, 0)} item{storeItems.reduce((s, i) => s + i.quantity, 0) !== 1 ? 's' : ''})
                    </span>
                    <span className="text-[#1A1A1A]/80 font-semibold">${subtotal.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {budgetStatus && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#1A1A1A]/50">Weekly budget</span>
                <span
                  className={`font-semibold ${
                    budgetStatus.level === 'over'
                      ? 'text-red-600'
                      : budgetStatus.level === 'approaching'
                        ? 'text-amber-600'
                        : 'text-[#2C742F]'
                  }`}
                >
                  {budgetStatus.level === 'over'
                    ? `$${(total - budgetStatus.budget).toFixed(2)} over budget`
                    : `$${budgetStatus.remaining.toFixed(2)} left of $${budgetStatus.budget.toFixed(2)}`}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[#1A1A1A] font-semibold text-base">Total</span>
              <span className="text-[#2C742F] font-extrabold text-xl">${total.toFixed(2)}</span>
            </div>

            <button
              onClick={() => { onClose(); router.push('/route'); }}
              className="w-full bg-[#2C742F] hover:bg-[#255f27] text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
            >
              Start Route
            </button>

            <p className="text-center text-[#1A1A1A]/35 text-xs">
              Prices are estimates and may vary in-store.
            </p>
          </div>
        )}
      </aside>
    </>
  );
}
