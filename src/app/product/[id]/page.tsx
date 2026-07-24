'use client';

import { use, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import AppHeader from '@/components/AppHeader';
import AccordionSection from '@/components/filters/AccordionSection';
import RecommendationActions from '@/components/RecommendationActions';
import { useCartStore } from '@/store/cartStore';
import { useSearchStore } from '@/store/searchStore';
import { useUserStore } from '@/store/userStore';
import { storeAccents } from '@/theme/colors';
import { isOrganicProduct } from '@/utils/filterProducts';
import { getGroceryFallbackImage } from '@/utils/groceryFallbackImage';
import { getCurrentCoordinates } from '@/services/locationService';
import { haversineDistanceMiles, formatMiles } from '@/utils/geo';
import { getStats, type PriceStats } from '@/services/priceHistoryService';
import { findSubstitution, type Substitution } from '@/services/substitutionService';
import { getPersonalizationProfile, type PersonalizationProfile } from '@/services/personalizationService';
import type { ApiProduct } from '@/types';

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function saleEndsDays(productId: string): number {
  return 2 + (hashCode(productId) % 10);
}

function calcPerUnit(price: number, size: string): string | null {
  const match = size.match(/(\d+(?:\.\d+)?)\s*(ct|count|oz|fl oz|lb|lbs|kg|g)/i);
  if (!match) return null;
  const qty = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (!(qty > 0)) return null;
  return `$${(price / qty).toFixed(2)} / ${unit}`;
}

function StarRatingRow({ rating, count }: { rating: number; count?: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = Math.max(0, 5 - full - (half ? 1 : 0));
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-amber-400 text-sm tracking-tight">
        {'★'.repeat(full)}{half ? '⯨' : ''}{'☆'.repeat(empty)}
      </span>
      <span className="text-[#1A1A1A] font-semibold text-sm">{rating.toFixed(1)}</span>
      {count !== undefined && <span className="text-[#1A1A1A]/40 text-sm">({count.toLocaleString()})</span>}
    </div>
  );
}

const SPARK_BAR_MIN_HEIGHT = 6;
const SPARK_BAR_MAX_HEIGHT = 28;

/** Compact price-history summary — current/average/lowest plus a small
 * bar sparkline. Only ever rendered once priceStats exists, i.e. once this
 * browser has genuinely observed the product at least twice. */
function PriceHistoryBlock({ stats }: { stats: PriceStats }) {
  const min = Math.min(...stats.sparkline);
  const max = Math.max(...stats.sparkline);
  const range = max - min || 1;
  const trendColor = stats.trend === 'down' ? '#2C742F' : stats.trend === 'up' ? '#B91C1C' : 'rgba(26,26,26,0.4)';

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 mt-3">
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-[#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <span className="text-[#1A1A1A] font-bold text-xs flex-1">Price History</span>
        {stats.trend !== 'flat' && (
          <span className="flex items-center gap-1 text-[11px] font-semibold" style={{ color: trendColor }}>
            {stats.trend === 'down' ? '↓' : '↑'} {Math.abs(stats.changePercent)}% vs average
          </span>
        )}
      </div>

      {stats.sparkline.length > 2 && (
        <div className="flex items-end gap-[3px] mt-2.5" style={{ height: SPARK_BAR_MAX_HEIGHT }}>
          {stats.sparkline.map((price, i) => (
            <div
              key={i}
              className="flex-1 bg-[#E0F3E2] rounded-sm"
              style={{ height: SPARK_BAR_MIN_HEIGHT + ((price - min) / range) * (SPARK_BAR_MAX_HEIGHT - SPARK_BAR_MIN_HEIGHT) }}
            />
          ))}
        </div>
      )}

      <div className="flex justify-around mt-3 pt-2.5 border-t border-gray-100">
        <PriceStat label="Current" value={stats.current} />
        <PriceStat label="Average" value={stats.average} />
        <PriceStat label="Lowest" value={stats.lowest} />
      </div>
    </div>
  );
}

function PriceStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[#1A1A1A] font-bold text-[13px]">${value.toFixed(2)}</span>
      <span className="text-[#1A1A1A]/50 text-[10.5px]">{label}</span>
    </div>
  );
}

function ProductPhoto({ product }: { product: ApiProduct }) {
  const [imgFailed, setImgFailed] = useState(false);
  return !imgFailed && product.image_url ? (
    <Image
      src={product.image_url}
      alt={product.name}
      fill
      className="object-contain p-6"
      sizes="(max-width: 640px) 100vw, 50vw"
      unoptimized
      onError={() => setImgFailed(true)}
    />
  ) : (
    <div className="flex items-center justify-center w-full h-full">
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not eligible for next/image optimization */}
      <img src={getGroceryFallbackImage(product.name)} alt="" className="w-16 h-16" />
    </div>
  );
}

function RelatedCard({ product, onAddToCart, onClick }: { product: ApiProduct; onAddToCart: () => void; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
      className="shrink-0 w-36 bg-white border border-gray-100 rounded-2xl overflow-hidden text-left hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="relative aspect-square bg-[#F8FDF8] overflow-hidden">
        <ProductPhoto product={product} />
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onAddToCart(); }}
          className="absolute top-2 right-2 w-7 h-7 bg-[#2C742F] rounded-full flex items-center justify-center shadow-md hover:bg-[#255f27] transition-colors"
          aria-label={`Add ${product.name} to cart`}
        >
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      <div className="p-2.5">
        <p className="text-[#1A1A1A] text-xs font-semibold leading-snug line-clamp-2 mb-1">{product.name}</p>
        <span className="text-[#2C742F] font-bold text-sm">${product.price.toFixed(2)}</span>
      </div>
    </div>
  );
}

/**
 * Product Detail — a real routed page (`/product/[id]`), resolved against
 * whatever the current browser session's search store already holds, the
 * same "requires prior search context" contract the Compare page has.
 * Direct port of shopsmart_mobile's ProductDetailScreen, laid out as a
 * two-column page (image / details) in the spirit of this app's own
 * former ProductModal, since that reads better on a wide viewport than a
 * single scrolling column.
 */
export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const decodedId = decodeURIComponent(id);
  const router = useRouter();

  const products = useSearchStore(s => s.products);
  const addToCart = useCartStore(s => s.addToCart);
  const ownerEmail = useUserStore(s => s.user?.email ?? '');

  const product = products.find(p => p.id === decodedId) ?? null;

  const [qty, setQty] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);

  const storeLat = product?.location?.latitude;
  const storeLng = product?.location?.longitude;
  useEffect(() => {
    if (storeLat == null || storeLng == null) return;
    let cancelled = false;
    getCurrentCoordinates().then(coords => {
      if (cancelled || !coords) return;
      setDistanceMiles(haversineDistanceMiles(coords, { latitude: storeLat, longitude: storeLng }));
    });
    return () => {
      cancelled = true;
    };
  }, [storeLat, storeLng]);

  const priceStats: PriceStats | null = useMemo(() => (product ? getStats(product) : null), [product]);

  const [profile, setProfile] = useState<PersonalizationProfile | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    if (!ownerEmail) return;
    getPersonalizationProfile(ownerEmail).then(p => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [ownerEmail]);

  const substitution: Substitution | null = useMemo(
    () => (product ? findSubstitution(product, products, profile) : null),
    [product, products, profile],
  );

  const related = useMemo(
    () => (product ? products.filter(p => p.id !== product.id && p.store === product.store).slice(0, 4) : []),
    [product, products],
  );

  if (!product) {
    return (
      <main className="min-h-screen bg-white flex flex-col">
        <AppHeader back={{ onClick: () => router.push('/'), title: 'Product' }} />
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-sm">
            <p className="text-[#1A1A1A] font-bold text-lg mb-2">Product not found</p>
            <p className="text-[#1A1A1A]/50 text-sm mb-6">
              This product link needs an active search first — start one below.
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

  const accent = storeAccents[product.store];
  const isOrganic = isOrganicProduct(product);
  const perUnit = calcPerUnit(product.price, product.size);
  const saleEndsIn = product.discountPercent != null ? saleEndsDays(product.id) : null;

  const handleAddToCart = () => {
    addToCart(product, qty);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  };

  return (
    <main className="min-h-screen bg-white">
      <AppHeader back={{ onClick: () => router.back(), title: product.name }} />

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid sm:grid-cols-2 gap-8">
          {/* ── Image ────────────────────────────────────────────────── */}
          <div className="relative aspect-square bg-[#F8FDF8] rounded-3xl overflow-hidden">
            <span
              className="absolute top-4 left-4 z-10 text-xs font-semibold px-3 py-1 rounded-full"
              style={{ backgroundColor: accent.background, color: accent.text }}
            >
              {product.store}
            </span>
            {isOrganic && (
              <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
                <svg className="w-4 h-4 text-[#2C742F]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.649 3.084A1 1 0 015.606 2h8.788a1 1 0 01.957.684l1.799 5.998a1 1 0 01-.957 1.316H14v4a1 1 0 01-1 1H7a1 1 0 01-1-1v-4H3.807a1 1 0 01-.957-1.316l1.799-5.998z" clipRule="evenodd" />
                </svg>
                <span className="text-[#2C742F] text-xs font-semibold">Organic</span>
              </div>
            )}
            <ProductPhoto product={product} />
          </div>

          {/* ── Details ──────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <StarRatingRow rating={product.rating} count={product.reviewCount} />
            <h2 className="text-[#1A1A1A] text-2xl font-bold leading-snug">{product.name}</h2>
            {product.upc && <p className="text-[#1A1A1A]/40 text-xs font-mono">UPC: {product.upc}</p>}
            {(product.size || perUnit) && (
              <p className="text-[#1A1A1A]/60 text-sm -mt-2">
                {[product.size, perUnit].filter(Boolean).join(' • ')}
              </p>
            )}

            {product.certifications && product.certifications.length > 0 && (
              <div>
                <p className="text-[#1A1A1A] text-sm font-semibold mb-2">Product information</p>
                <div className="flex flex-wrap gap-2">
                  {product.certifications.map(cert => (
                    <span
                      key={cert}
                      className="flex items-center gap-1 bg-[#E0F3E2] text-[#2C742F] text-xs font-semibold px-3 py-1.5 rounded-full"
                    >
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="bg-[#7B2D2D] text-white font-extrabold text-2xl px-4 py-1.5 rounded-xl">
                  ${product.price.toFixed(2)}
                </span>
                {product.originalPrice != null && (
                  <>
                    <span className="text-[#1A1A1A]/40 line-through text-base">${product.originalPrice.toFixed(2)}</span>
                    <span className="text-[#2C742F] font-bold text-sm">{product.discountPercent}% off</span>
                  </>
                )}
              </div>

              {saleEndsIn != null && (
                <p className="text-[#1A1A1A]/50 text-xs">Sale ends in {saleEndsIn} day{saleEndsIn !== 1 ? 's' : ''}</p>
              )}

              <div className="flex items-center gap-3">
                <span className="text-[#1A1A1A]/60 text-sm">Qty:</span>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-6 h-6 flex items-center justify-center text-[#1A1A1A]/60 hover:text-[#2C742F] transition-colors font-bold text-lg leading-none"
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold text-sm">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(q => q + 1)}
                    className="w-6 h-6 flex items-center justify-center text-[#1A1A1A]/60 hover:text-[#2C742F] transition-colors font-bold text-lg leading-none"
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddToCart}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
                  addedFeedback ? 'bg-[#E0F3E2] text-[#2C742F]' : 'bg-[#2C742F] hover:bg-[#255f27] text-white'
                }`}
              >
                {addedFeedback ? '✓ Added to Cart' : 'Add to Cart'}
              </button>
            </div>

            {priceStats && <PriceHistoryBlock stats={priceStats} />}

            {substitution && (
              <div className="flex items-start gap-3 bg-[#E0F3E2] rounded-2xl p-4">
                <svg className="w-[18px] h-[18px] text-[#2C742F] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4" />
                </svg>
                <div className="flex-1">
                  <p className="text-[#1A1A1A] font-bold text-[12.5px]">Try {substitution.product.name} instead</p>
                  <p className="text-[#1A1A1A]/60 text-[11.5px] mt-0.5">{substitution.reason}</p>
                  <RecommendationActions
                    onSeeProduct={() => router.push(`/product/${encodeURIComponent(substitution.product.id)}`)}
                    onAddToCart={() => addToCart(substitution.product)}
                  />
                </div>
              </div>
            )}

            <div className="border-t border-gray-100">
              <AccordionSection title="Details" defaultExpanded>
                <div className="pb-4 text-sm text-[#1A1A1A]/70 space-y-1">
                  <p><span className="font-medium text-[#1A1A1A]/85">Brand:</span> {product.brand}</p>
                  {product.size && <p><span className="font-medium text-[#1A1A1A]/85">Size:</span> {product.size}</p>}
                  {product.upc && <p><span className="font-medium text-[#1A1A1A]/85">UPC:</span> {product.upc}</p>}
                  <p><span className="font-medium text-[#1A1A1A]/85">Available at:</span> {product.store}</p>
                </div>
              </AccordionSection>

              <AccordionSection title="Store Location" defaultExpanded>
                {product.location ? (
                  <div className="flex gap-3 pb-4">
                    <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: accent.dot }} />
                    <div className="flex-1">
                      <p className="text-[#1A1A1A] font-semibold text-[13.5px] mb-0.5">{product.location.name}</p>
                      <p className="text-[#1A1A1A]/65 text-sm leading-snug">{product.location.address}</p>
                      <p className="text-[#1A1A1A]/65 text-sm leading-snug">
                        {product.location.city}, {product.location.state} {product.location.zip}
                      </p>
                      {distanceMiles != null && (
                        <p className="text-[#2C742F] font-semibold text-xs mt-1.5">{formatMiles(distanceMiles)} away</p>
                      )}
                    </div>
                  </div>
                ) : (
                  // Never guess an address — if this store's real location
                  // couldn't be resolved, say so explicitly rather than
                  // silently hiding the section or showing stale/wrong data.
                  <div className="flex gap-3 pb-4">
                    <svg className="w-[18px] h-[18px] text-[#1A1A1A]/40 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-[#1A1A1A]/50 text-sm leading-snug flex-1">
                      Location unavailable for this store right now.
                    </p>
                  </div>
                )}
              </AccordionSection>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <div className="mt-8 pt-6 border-t border-gray-100">
            <h3 className="text-[#1A1A1A] font-bold text-base mb-4">Picked For You</h3>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {related.map(p => (
                <RelatedCard
                  key={p.id}
                  product={p}
                  onAddToCart={() => addToCart(p)}
                  onClick={() => router.push(`/product/${encodeURIComponent(p.id)}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
