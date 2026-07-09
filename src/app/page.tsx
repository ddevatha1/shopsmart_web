'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ApiProduct, CartItem, SearchResponse, StoreStatus, User } from '@/types';
import ProductCard from '@/components/ProductCard';
import AuthModal from '@/components/AuthModal';
import CartDrawer from '@/components/CartDrawer';
import ProductModal from '@/components/ProductModal';
import ProfileTray from '@/components/ProfileTray';

const ALL_STORES: ApiProduct['store'][] = ["Trader Joe's", 'Sprouts', 'Kroger', 'Aldi'];

const POPULAR = ['Organic Milk', 'Avocados', 'Chicken Breast', 'Almond Butter', 'Sourdough Bread'];

const SCAN_PHASES = [
  'Connecting to',
  'Querying',
  'Scanning indexes for',
  'Finalizing results from',
];

const STORE_DOT: Record<ApiProduct['store'], string> = {
  "Trader Joe's": 'bg-rose-500',
  Sprouts: 'bg-emerald-500',
  Kroger: 'bg-sky-600',
  Aldi: 'bg-cyan-700',
};

const LS_USER_KEY = 'shopsmart_user';
const LS_CART_KEY = 'shopsmart_cart';

// ─── Sub-components ────────────────────────────────────────────────────────────

function ScannerTray({ statuses, phase }: { statuses: StoreStatus[]; phase: number }) {
  return (
    <div className="py-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="w-2 h-2 bg-[#2C742F] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-[#2C742F] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-[#2C742F] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        <span className="text-[#1A1A1A] text-sm font-medium ml-1">Scanning all stores in parallel…</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {statuses.map((s, i) => (
          <div key={s.store} className="bg-white border border-gray-100 rounded-xl p-4 text-center">
            <span
              className={`inline-block w-2 h-2 rounded-full mb-2 ${STORE_DOT[s.store]} ${
                s.status === 'loading' ? 'animate-pulse' : ''
              }`}
            />
            <div className="text-[#1A1A1A] font-semibold text-xs mb-1 truncate">{s.store}</div>
            <div className="text-[11px] leading-snug">
              {s.status === 'loading' && (
                <span className="text-[#1A1A1A]/45">
                  {SCAN_PHASES[(phase + i) % SCAN_PHASES.length]} {s.store}…
                </span>
              )}
              {s.status === 'success' && (
                <span className="text-[#2C742F] font-medium">{s.count} found</span>
              )}
              {s.status === 'error' && <span className="text-red-500">Unavailable</span>}
              {s.status === 'pending' && <span className="text-[#1A1A1A]/30">Pending…</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <div className="max-w-lg mx-auto py-16">
      <div className="bg-red-50 border border-red-200 rounded-3xl p-8 text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-[#1A1A1A] font-bold text-lg mb-2">Could not reach store data</h3>
        <p className="text-[#1A1A1A]/55 text-sm mb-6">{message}</p>

        {/* Actionable fixes */}
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

function StoreFilterRail({
  storeFilter,
  onToggleStore,
  storeStatuses,
}: {
  storeFilter: Set<ApiProduct['store']>;
  onToggleStore: (store: ApiProduct['store']) => void;
  storeStatuses: StoreStatus[];
}) {
  return (
    <aside className="lg:w-60 shrink-0">
      <div className="bg-white border border-gray-100 rounded-2xl p-5 sticky top-24">
        <h3 className="text-[#1A1A1A] text-sm font-semibold mb-3">Filter by Store</h3>
        <div className="flex flex-col gap-2">
          {storeStatuses.map(s => (
            <label
              key={s.store}
              className="flex items-center justify-between gap-2 text-sm cursor-pointer group"
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={storeFilter.has(s.store)}
                  onChange={() => onToggleStore(s.store)}
                  className="w-4 h-4 rounded border-gray-300 text-[#2C742F] focus:ring-[#2C742F]"
                />
                <span className={`${storeFilter.has(s.store) ? 'text-[#1A1A1A]/80' : 'text-[#1A1A1A]/40'} group-hover:text-[#1A1A1A] transition-colors`}>
                  {s.store}
                </span>
              </span>
              {s.status === 'success' && (
                <span className="text-[#1A1A1A]/30 text-xs tabular-nums">{s.count}</span>
              )}
            </label>
          ))}
        </div>
        <p className="mt-4 text-[#1A1A1A]/30 text-[11px] flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          Results sorted: Low to High
        </p>
      </div>
    </aside>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  // Search state
  const [query, setQuery] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [storeStatuses, setStoreStatuses] = useState<StoreStatus[]>(
    ALL_STORES.map(store => ({ store, status: 'pending' as const })),
  );
  const [activeQuery, setActiveQuery] = useState('');
  const [activeZip, setActiveZip] = useState('');
  const [phase, setPhase] = useState(0);
  const phaseTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filter (sort is always ascending — enforced server-side)
  const [storeFilter, setStoreFilter] = useState<Set<ApiProduct['store']>>(new Set(ALL_STORES));

  // UI overlays
  const [authOpen, setAuthOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ApiProduct | null>(null);

  // Cart
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Auth
  const [user, setUser] = useState<User | null>(null);

  // ── Hydrate from localStorage (client only) ────────────────────────────────
  useEffect(() => {
    try {
      const rawUser = localStorage.getItem(LS_USER_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (rawUser) setUser(JSON.parse(rawUser));
      const rawCart = localStorage.getItem(LS_CART_KEY);
      if (rawCart) setCartItems(JSON.parse(rawCart));
    } catch {
      // Ignore malformed storage
    }
  }, []);

  // Persist user to localStorage
  useEffect(() => {
    if (user) {
      localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LS_USER_KEY);
    }
  }, [user]);

  // Persist cart to localStorage
  useEffect(() => {
    localStorage.setItem(LS_CART_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  // ── Phase animation during scan ────────────────────────────────────────────
  useEffect(() => {
    if (loading) {
      phaseTimer.current = setInterval(() => setPhase(p => p + 1), 700);
    } else if (phaseTimer.current) {
      clearInterval(phaseTimer.current);
    }
    return () => {
      if (phaseTimer.current) clearInterval(phaseTimer.current);
    };
  }, [loading]);

  // ── Search handler ─────────────────────────────────────────────────────────
  const runSearch = useCallback(async (q: string, zip: string) => {
    setHasSearched(true);
    setLoading(true);
    setError(null);
    setProducts([]);
    setStoreFilter(new Set(ALL_STORES));
    setStoreStatuses(ALL_STORES.map(store => ({ store, status: 'loading' as const })));
    setActiveQuery(q);
    setActiveZip(zip);

    // Track search history on user profile
    setUser(prev => {
      if (!prev) return prev;
      const history = [...(prev.searchHistory ?? [])];
      if (!history.includes(q)) history.push(q);
      return { ...prev, searchHistory: history.slice(-20) };
    });

    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, zipcode: zip }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Server returned ${res.status}`);
      }
      const data = (await res.json()) as SearchResponse;
      setProducts(data.products ?? []);
      setStoreStatuses(data.storeStatuses ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || zipcode.length !== 5) return;
    runSearch(query.trim(), zipcode.trim());
  };

  // ── Store filter toggle ────────────────────────────────────────────────────
  const toggleStore = (store: ApiProduct['store']) => {
    setStoreFilter(prev => {
      const next = new Set(prev);
      if (next.has(store)) {
        if (next.size === 1) return prev; // always keep at least one
        next.delete(store);
      } else {
        next.add(store);
      }
      return next;
    });
  };

  // ── Cart actions ───────────────────────────────────────────────────────────
  const addToCart = useCallback((product: ApiProduct, qty = 1) => {
    setCartItems(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { product, quantity: qty }];
    });
  }, []);

  const updateCartQty = useCallback((productId: string, qty: number) => {
    setCartItems(prev =>
      qty <= 0
        ? prev.filter(i => i.product.id !== productId)
        : prev.map(i => i.product.id === productId ? { ...i, quantity: qty } : i),
    );
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setCartItems(prev => prev.filter(i => i.product.id !== productId));
  }, []);

  // ── Auth actions ───────────────────────────────────────────────────────────
  const handleAuth = (newUser: User) => {
    setUser(newUser);
  };

  const handleSignOut = () => {
    setUser(null);
    localStorage.removeItem(LS_USER_KEY);
  };

  // ── Derived display list (filtered; sort already applied by API) ───────────
  const displayed = products.filter(p => storeFilter.has(p.store));
  const cartCount = cartItems.reduce((s, i) => s + i.quantity, 0);

  return (
    <main className="min-h-screen bg-white">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          {/* Logo */}
          <span className="text-xl font-extrabold text-[#1A1A1A] shrink-0">
            Shop<span className="text-[#2C742F]">Smart</span>
          </span>

          <span className="hidden sm:inline text-xs font-medium text-[#2C742F] bg-[#E0F3E2] px-3 py-1 rounded-full shrink-0">
            5 stores · 1 search
          </span>

          <div className="flex items-center gap-2 ml-auto">
            {/* Cart button */}
            <button
              onClick={() => { setCartOpen(true); setProfileOpen(false); }}
              className="relative w-10 h-10 rounded-full bg-gray-100 hover:bg-[#E0F3E2] flex items-center justify-center transition-colors"
              aria-label="Open cart"
            >
              <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#2C742F] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </button>

            {/* Auth / profile button */}
            {user ? (
              <button
                onClick={() => { setProfileOpen(true); setCartOpen(false); }}
                className="flex items-center gap-2 bg-[#E0F3E2] hover:bg-[#d0ebd2] px-3 py-2 rounded-full transition-colors"
                aria-label="Open profile"
              >
                <div className="w-6 h-6 bg-[#2C742F] rounded-full flex items-center justify-center text-white text-[10px] font-bold select-none">
                  {user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <span className="text-[#2C742F] text-xs font-semibold hidden sm:inline">
                  {user.name.split(' ')[0]}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="bg-[#2C742F] hover:bg-[#255f27] text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero search section ──────────────────────────────────────────────── */}
      <section className="bg-[#E0F3E2]">
        <div className="max-w-4xl mx-auto px-4 py-14 text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#1A1A1A] tracking-tight mb-3">
            Compare grocery prices, instantly
          </h1>
          <p className="text-[#1A1A1A]/60 text-base sm:text-lg mb-8 max-w-xl mx-auto">
            Search for groceries at Trader Joe&apos;s, Sprouts, Kroger, and Aldi stores near you.
          </p>

          <form
            onSubmit={handleSearch}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="e.g. Organic Oat Milk"
                className="flex-1 bg-white border border-gray-100 rounded-xl px-4 py-3 text-[#1A1A1A] placeholder-[#1A1A1A]/35 focus:outline-none focus:border-[#2C742F] focus:ring-2 focus:ring-[#2C742F]/15 transition-all text-sm"
                required
              />
              <input
                type="text"
                inputMode="numeric"
                value={zipcode}
                onChange={e => setZipcode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="ZIP Code"
                className="sm:w-36 bg-white border border-gray-100 rounded-xl px-4 py-3 text-[#1A1A1A] placeholder-[#1A1A1A]/35 focus:outline-none focus:border-[#2C742F] focus:ring-2 focus:ring-[#2C742F]/15 transition-all text-sm"
                required
                maxLength={5}
                pattern="\d{5}"
              />
              <button
                type="submit"
                disabled={loading || !query.trim() || zipcode.length !== 5}
                className="bg-[#2C742F] hover:bg-[#255f27] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-colors whitespace-nowrap text-sm"
              >
                {loading ? 'Searching…' : 'Search All Stores'}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-1">
              <span className="text-[#1A1A1A]/40 text-xs">Popular:</span>
              {POPULAR.map(term => (
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

      {/* ── Dashboard body ───────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 py-10">
        {/* Empty state */}
        {!hasSearched && (
          <div className="text-center py-16">
            <div className="flex justify-center gap-2 mb-4">
              {ALL_STORES.map(s => (
                <span key={s} className={`w-2.5 h-2.5 rounded-full ${STORE_DOT[s]}`} />
              ))}
            </div>
            <p className="text-[#1A1A1A]/50 text-sm">
              Enter a product and ZIP code above to compare prices across all five stores.
            </p>
          </div>
        )}

        {/* Loading scanner */}
        {hasSearched && loading && <ScannerTray statuses={storeStatuses} phase={phase} />}

        {/* Error state with actionable self-fixes */}
        {hasSearched && !loading && error && <ErrorPanel message={error} />}

        {/* Results */}
        {hasSearched && !loading && !error && (
          <div className="flex flex-col lg:flex-row gap-8">
            <StoreFilterRail
              storeFilter={storeFilter}
              onToggleStore={toggleStore}
              storeStatuses={storeStatuses}
            />

            <div className="flex-1 min-w-0">
              {/* Results header */}
              <div className="mb-6">
                <h2 className="text-xl font-bold text-[#1A1A1A]">
                  {displayed.length}{' '}
                  <span className="text-[#1A1A1A]/45 font-normal">
                    result{displayed.length !== 1 ? 's' : ''} for
                  </span>{' '}
                  <span className="text-[#2C742F]">&ldquo;{activeQuery}&rdquo;</span>
                </h2>
                <p className="text-[#1A1A1A]/40 text-sm mt-0.5">
                  near {activeZip} &middot;{' '}
                  {storeStatuses.filter(s => s.status === 'success').length} of{' '}
                  {storeStatuses.length} stores responded &middot; sorted low to high
                </p>
              </div>

              {displayed.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-[#1A1A1A]/50 text-base font-medium mb-1">No products found</p>
                  <p className="text-[#1A1A1A]/35 text-sm">
                    {products.length > 0
                      ? 'All stores are hidden — check a box in the sidebar to show results.'
                      : 'Try a different search term or ZIP code.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {displayed.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      onAddToCart={addToCart}
                      onClick={setSelectedProduct}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Overlays ──────────────────────────────────────────────────────────── */}

      <AuthModal
        key={authOpen ? 'auth-open' : 'auth-closed'}
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuth={handleAuth}
      />

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cartItems}
        onUpdateQty={updateCartQty}
        onRemove={removeFromCart}
        zipcode={activeZip || (user?.zipcode ?? '')}
      />

      <ProductModal
        key={selectedProduct?.id ?? 'empty'}
        product={selectedProduct}
        allProducts={products}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={addToCart}
      />

      {user && (
        <ProfileTray
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          cartItems={cartItems}
          onSignOut={handleSignOut}
        />
      )}
    </main>
  );
}

