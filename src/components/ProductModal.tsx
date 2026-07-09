'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { ApiProduct } from '@/types';

interface ProductModalProps {
  product: ApiProduct | null;
  allProducts: ApiProduct[];
  onClose: () => void;
  onAddToCart: (product: ApiProduct, qty: number) => void;
}

const STORE_STYLE: Record<ApiProduct['store'], { bg: string; text: string }> = {
  "Trader Joe's": { bg: 'bg-rose-100', text: 'text-rose-700' },
  Sprouts: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Kroger: { bg: 'bg-sky-100', text: 'text-sky-700' },
  Aldi: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
};
const CATEGORY_FALLBACKS: Array<[RegExp, () => React.ReactNode]> = [
  [/milk|dairy|cream|yogurt|butter|cheese/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <rect x="18" y="10" width="28" height="44" rx="6" fill="#E0F3E2" stroke="#2C742F" strokeWidth="2"/>
      <rect x="22" y="16" width="20" height="8" rx="2" fill="#A8D5AA"/>
      <circle cx="32" cy="38" r="6" fill="#A8D5AA"/>
    </svg>
  )],
  [/bread|loaf|baguette|sourdough|roll|bagel|muffin/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <ellipse cx="32" cy="36" rx="22" ry="14" fill="#F5DEB3" stroke="#C4923A" strokeWidth="2"/>
      <ellipse cx="32" cy="30" rx="18" ry="10" fill="#DEB887" stroke="#C4923A" strokeWidth="1.5"/>
    </svg>
  )],
  [/egg|eggs/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <ellipse cx="32" cy="34" rx="16" ry="20" fill="#FFF9E6" stroke="#D4A040" strokeWidth="2"/>
      <ellipse cx="32" cy="38" rx="8" ry="10" fill="#FFD966" opacity="0.6"/>
    </svg>
  )],
  [/chicken|poultry|turkey/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <ellipse cx="32" cy="36" rx="18" ry="14" fill="#FFE4B5" stroke="#C4923A" strokeWidth="2"/>
      <circle cx="32" cy="22" r="8" fill="#FFE4B5" stroke="#C4923A" strokeWidth="2"/>
    </svg>
  )],
  [/beef|steak|ground|meat|pork|lamb/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <rect x="12" y="24" width="40" height="20" rx="8" fill="#C0392B" opacity="0.7" stroke="#922B21" strokeWidth="2"/>
      <rect x="16" y="28" width="32" height="12" rx="4" fill="#E74C3C" opacity="0.5"/>
    </svg>
  )],
  [/fish|salmon|tuna|shrimp|seafood/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <ellipse cx="30" cy="32" rx="18" ry="10" fill="#85C1E9" stroke="#2980B9" strokeWidth="2"/>
      <path d="M48 32 L56 24 L56 40 Z" fill="#2980B9"/>
      <circle cx="22" cy="30" r="2" fill="#1A5276"/>
    </svg>
  )],
  [/apple|orange|banana|berry|fruit|grape|strawberry|peach|plum/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <circle cx="32" cy="36" r="18" fill="#E74C3C" stroke="#C0392B" strokeWidth="2"/>
      <path d="M32 18 Q36 10 44 12" stroke="#2ECC71" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  )],
  [/spinach|kale|lettuce|salad|broccoli|vegetable|veggie|produce/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <ellipse cx="32" cy="38" rx="20" ry="14" fill="#27AE60" stroke="#1E8449" strokeWidth="2"/>
      <path d="M32 38 Q20 24 24 12" stroke="#1E8449" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M32 38 Q44 24 40 12" stroke="#1E8449" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  )],
  [/coffee|espresso|latte|mocha/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <rect x="16" y="28" width="28" height="24" rx="4" fill="#6F4E37" stroke="#4A3728" strokeWidth="2"/>
      <ellipse cx="30" cy="28" rx="14" ry="4" fill="#8B6651"/>
      <path d="M44 36 Q52 36 52 42 Q52 48 44 48" stroke="#4A3728" strokeWidth="2" fill="none"/>
    </svg>
  )],
  [/water|soda|juice|drink|beverage|tea/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <rect x="22" y="14" width="20" height="38" rx="8" fill="#AED6F1" stroke="#2E86C1" strokeWidth="2"/>
      <rect x="26" y="8" width="12" height="8" rx="3" fill="#AED6F1" stroke="#2E86C1" strokeWidth="2"/>
      <ellipse cx="32" cy="38" rx="8" ry="6" fill="#7FB3D3" opacity="0.5"/>
    </svg>
  )],
  [/cereal|oat|granola|grain/i, () => (
    <svg viewBox="0 0 64 64" className="w-16 h-16" fill="none">
      <rect x="16" y="12" width="32" height="42" rx="6" fill="#F5CBA7" stroke="#E59866" strokeWidth="2"/>
      <rect x="20" y="18" width="24" height="6" rx="2" fill="#E59866"/>
      <circle cx="26" cy="34" r="3" fill="#E59866"/>
      <circle cx="38" cy="34" r="3" fill="#E59866"/>
      <circle cx="32" cy="42" r="3" fill="#E59866"/>
    </svg>
  )],
];

function CategoryFallback({ name }: { name: string }) {
  for (const [pattern, render] of CATEGORY_FALLBACKS) {
    if (pattern.test(name)) {
      return (
        <div className="flex items-center justify-center w-full h-full bg-[#F8FDF8]">
          {render()}
        </div>
      );
    }
  }
  // Generic grocery bag fallback
  return (
    <div className="flex items-center justify-center w-full h-full bg-[#F8FDF8]">
      <svg className="w-16 h-16 text-[#2C742F]/25" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
          d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    </div>
  );
}

function StarRating({ rating, count }: { rating: number; count?: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = Math.max(0, 5 - full - (half ? 1 : 0));
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-amber-400 text-sm tracking-tight">
        {'★'.repeat(full)}
        {half ? '⯨' : ''}
        {'☆'.repeat(empty)}
      </span>
      <span className="text-[#1A1A1A] font-semibold text-sm">{rating.toFixed(1)}</span>
      {count !== undefined && (
        <span className="text-[#1A1A1A]/40 text-sm">({count.toLocaleString()})</span>
      )}
    </div>
  );
}

function SaleEndsDays(productId: string): number {
  let h = 0;
  for (let i = 0; i < productId.length; i++) {
    h = (Math.imul(31, h) + productId.charCodeAt(i)) | 0;
  }
  return 2 + (Math.abs(h) % 10);
}

function calcPerUnit(price: number, size: string): string | null {
  const match = size.match(/(\d+(?:\.\d+)?)\s*(ct|count|oz|fl oz|lb|lbs|kg|g)/i);
  if (!match) return null;
  const qty = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (qty <= 0) return null;
  const perUnit = price / qty;
  return `$${perUnit.toFixed(2)} / ${unit}`;
}

export default function ProductModal({
  product,
  allProducts,
  onClose,
  onAddToCart,
}: ProductModalProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [qty, setQty] = useState(1);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // State resets naturally when the parent passes a new `key` prop
  // (see page.tsx: <ProductModal key={selectedProduct?.id ?? 'empty'} ... />)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (product) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [product, onClose]);

  if (!product) return null;

  const style = STORE_STYLE[product.store];
  const perUnit = calcPerUnit(product.price, product.size);
  const saleEndsIn = product.discountPercent ? SaleEndsDays(product.id) : null;

  const relatedProducts = allProducts
    .filter(p => p.id !== product.id && p.store === product.store)
    .slice(0, 4);

  const handleAddToCart = () => {
    onAddToCart(product, qty);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div className="relative bg-white w-full max-w-3xl mx-0 sm:mx-4 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[95vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <svg className="w-4 h-4 text-[#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="grid sm:grid-cols-2 gap-0">
          {/* ── Left: Image ──────────────────────────────────────────── */}
          <div className="relative aspect-square bg-[#F8FDF8] rounded-t-3xl sm:rounded-l-3xl sm:rounded-tr-none overflow-hidden">
            <span className={`absolute top-4 left-4 z-10 text-xs font-semibold px-3 py-1 rounded-full ${style.bg} ${style.text}`}>
              {product.store}
            </span>

            {product.certifications?.includes('Organic') && (
              <div className="absolute bottom-4 left-4 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-sm">
                <svg className="w-4 h-4 text-[#2C742F]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.649 3.084A1 1 0 015.606 2h8.788a1 1 0 01.957.684l1.799 5.998a1 1 0 01-.957 1.316H14v4a1 1 0 01-1 1H7a1 1 0 01-1-1v-4H3.807a1 1 0 01-.957-1.316l1.799-5.998z" clipRule="evenodd" />
                </svg>
                <span className="text-[#2C742F] text-xs font-semibold">Organic</span>
              </div>
            )}

            {!imgFailed && product.image_url ? (
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
              <CategoryFallback name={product.name} />
            )}
          </div>

          {/* ── Right: Details ───────────────────────────────────────── */}
          <div className="p-6 sm:p-8 flex flex-col gap-4">
            {/* Rating */}
            <StarRating rating={product.rating} count={product.reviewCount} />

            {/* Product name */}
            <h2 className="text-[#1A1A1A] text-xl sm:text-2xl font-bold leading-snug">
              {product.name}
            </h2>

            {/* UPC */}
            {product.upc && (
              <p className="text-[#1A1A1A]/40 text-xs font-mono">UPC: {product.upc}</p>
            )}

            {/* Size + per-unit */}
            {(product.size || perUnit) && (
              <p className="text-[#1A1A1A]/60 text-sm">
                {product.size}
                {perUnit && <> &bull; {perUnit}</>}
              </p>
            )}

            {/* Certifications */}
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

            {/* Price box */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="bg-[#7B2D2D] text-white font-extrabold text-2xl px-4 py-1.5 rounded-xl">
                  ${product.price.toFixed(2)}
                </span>
                {product.originalPrice && (
                  <>
                    <span className="text-[#1A1A1A]/40 line-through text-base">
                      ${product.originalPrice.toFixed(2)}
                    </span>
                    <span className="text-[#2C742F] font-bold text-sm">
                      {product.discountPercent}% off
                    </span>
                  </>
                )}
              </div>

              {saleEndsIn && (
                <p className="text-[#1A1A1A]/50 text-xs">
                  Sale ends in {saleEndsIn} day{saleEndsIn !== 1 ? 's' : ''}
                </p>
              )}

              {/* Quantity selector */}
              <div className="flex items-center gap-3">
                <span className="text-[#1A1A1A]/60 text-sm">Qty:</span>
                <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
                  <button
                    onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-6 h-6 flex items-center justify-center text-[#1A1A1A]/60 hover:text-[#2C742F] transition-colors font-bold text-lg leading-none"
                    aria-label="Decrease"
                  >
                    −
                  </button>
                  <span className="w-8 text-center font-semibold text-sm">{qty}</span>
                  <button
                    onClick={() => setQty(q => q + 1)}
                    className="w-6 h-6 flex items-center justify-center text-[#1A1A1A]/60 hover:text-[#2C742F] transition-colors font-bold text-lg leading-none"
                    aria-label="Increase"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Add to cart button */}
              <button
                onClick={handleAddToCart}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${
                  addedFeedback
                    ? 'bg-[#E0F3E2] text-[#2C742F]'
                    : 'bg-[#2C742F] hover:bg-[#255f27] text-white'
                }`}
              >
                {addedFeedback ? '✓ Added to Cart' : 'Add to Cart'}
              </button>
            </div>

            {/* Accordions */}
            <div className="space-y-0 border-t border-gray-100">
              <button
                onClick={() => setDetailsOpen(o => !o)}
                className="w-full flex items-center justify-between py-4 text-left text-[#1A1A1A] font-semibold text-sm border-b border-gray-100"
                aria-expanded={detailsOpen}
              >
                Details
                <svg
                  className={`w-4 h-4 text-[#1A1A1A]/40 transition-transform ${detailsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {detailsOpen && (
                <div className="py-3 text-sm text-[#1A1A1A]/60 border-b border-gray-100 space-y-1">
                  {product.brand && <p><span className="font-medium text-[#1A1A1A]/80">Brand:</span> {product.brand}</p>}
                  {product.size && <p><span className="font-medium text-[#1A1A1A]/80">Size:</span> {product.size}</p>}
                  {product.upc && <p><span className="font-medium text-[#1A1A1A]/80">UPC:</span> {product.upc}</p>}
                  {product.category && <p><span className="font-medium text-[#1A1A1A]/80">Category:</span> {product.category}</p>}
                  {product.aisle && <p><span className="font-medium text-[#1A1A1A]/80">Aisle:</span> {product.aisle}</p>}
                  {product.store && <p><span className="font-medium text-[#1A1A1A]/80">Available at:</span> {product.store}</p>}
                </div>
              )}

              <button
                onClick={() => setDirectionsOpen(o => !o)}
                className="w-full flex items-center justify-between py-4 text-left text-[#1A1A1A] font-semibold text-sm"
                aria-expanded={directionsOpen}
              >
                Directions
                <svg
                  className={`w-4 h-4 text-[#1A1A1A]/40 transition-transform ${directionsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {directionsOpen && (
                <div className="py-3 text-sm text-[#1A1A1A]/60">
                  Please refer to the product packaging for storage and usage directions.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Picked For You */}
        {relatedProducts.length > 0 && (
          <div className="border-t border-gray-100 px-6 sm:px-8 py-6">
            <h3 className="text-[#1A1A1A] font-bold text-base mb-4">Picked For You</h3>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2">
              {relatedProducts.map(related => (
                <RelatedCard
                  key={related.id}
                  product={related}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RelatedCard({
  product,
  onAddToCart,
}: {
  product: ApiProduct;
  onAddToCart: (p: ApiProduct, qty: number) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="shrink-0 w-36 bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="relative aspect-square bg-[#F8FDF8] overflow-hidden">
        {!imgFailed && product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-contain p-2"
            sizes="144px"
            unoptimized
            onError={() => setImgFailed(true)}
          />
        ) : (
          <CategoryFallback name={product.name} />
        )}
        <button
          onClick={() => onAddToCart(product, 1)}
          className="absolute top-2 right-2 w-7 h-7 bg-[#2C742F] rounded-full flex items-center justify-center shadow-md hover:bg-[#255f27] transition-colors"
          aria-label={`Add ${product.name} to cart`}
        >
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
      <div className="p-2.5">
        <p className="text-[#1A1A1A] text-xs font-semibold leading-snug line-clamp-2 mb-1">
          {product.name}
        </p>
        <span className="text-[#2C742F] font-bold text-sm">${product.price.toFixed(2)}</span>
      </div>
    </div>
  );
}
