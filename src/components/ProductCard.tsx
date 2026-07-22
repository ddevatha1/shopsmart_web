'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ApiProduct } from '@/types';
import { getGroceryFallbackImage } from '@/utils/groceryFallbackImage';

interface ProductCardProps {
  product: ApiProduct;
  onAddToCart: (product: ApiProduct) => void;
  onClick: (product: ApiProduct) => void;
  /** Normalized comparison price (e.g. "$0.62 / apple") — shown as a
   * secondary line under the total price. Only ever set on the Compare
   * page (see comparisonService); every other caller omits it and the
   * card looks exactly as it always has. */
  unitPriceLabel?: string;
  /** Marks this as the comparison engine's single featured recommendation —
   * a green accent border plus a "Best Value" ribbon, not a new card. */
  bestValue?: boolean;
  /** Short savings callout (e.g. "Save $2.10") shown alongside the unit
   * price — only meaningful together with `bestValue`. */
  savingsLabel?: string;
}

const STORE_STYLE: Record<ApiProduct['store'], { bg: string; text: string }> = {
  "Trader Joe's": { bg: 'bg-rose-100', text: 'text-rose-700' },
  Sprouts: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  Kroger: { bg: 'bg-sky-100', text: 'text-sky-700' },
  Aldi: { bg: 'bg-cyan-100', text: 'text-cyan-700' },
};
// Dictionary-driven category icon, generated from the product name — see
// src/utils/groceryFallbackImage.ts for the keyword → graphic mapping. Used
// whenever a product has no live image, or its live image fails to load.
function SmartImageFallback({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-center w-full h-full bg-[#F8FDF8]">
      {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not eligible for next/image optimization */}
      <img src={getGroceryFallbackImage(name)} alt="" className="w-12 h-12" />
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = Math.max(0, 5 - full - (half ? 1 : 0));
  return (
    <div className="flex items-center gap-1">
      <span className="text-amber-400 text-xs tracking-tight">
        {'★'.repeat(full)}
        {half ? '⯨' : ''}
        {'☆'.repeat(empty)}
      </span>
      <span className="text-[#1A1A1A]/40 text-xs">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function ProductCard({
  product, onAddToCart, onClick, unitPriceLabel, bestValue, savingsLabel,
}: ProductCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [cartFeedback, setCartFeedback] = useState(false);
  const style = STORE_STYLE[product.store];

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddToCart(product);
    setCartFeedback(true);
    setTimeout(() => setCartFeedback(false), 1500);
  };

  return (
    <article
      onClick={() => onClick(product)}
      className={`group bg-white border rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-black/8 hover:-translate-y-0.5 transition-all duration-200 flex flex-col cursor-pointer ${
        bestValue ? 'border-[#2C742F] border-[1.5px]' : 'border-gray-100'
      }`}
      role="button"
      tabIndex={0}
      aria-label={`View ${product.name} details`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(product); }}
    >
      {bestValue && (
        <div className="flex items-center justify-center gap-1.5 bg-[#2C742F] py-1.5">
          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 3a1 1 0 012 0v1h3a1 1 0 011 1v1a4 4 0 01-4 4h-.09A4.002 4.002 0 0113 11.9V13h2a1 1 0 110 2H5a1 1 0 110-2h2v-1.1A4.002 4.002 0 013.09 9H3a1 1 0 01-1-1V6a1 1 0 011-1h3V4a1 1 0 011-1z" />
          </svg>
          <span className="text-white text-[11px] font-bold tracking-wide">Best Value</span>
        </div>
      )}
      {/* ── Image region ─────────────────────────────────────────────── */}
      <div className="relative aspect-square bg-[#F8FDF8] overflow-hidden">
        {/* Store badge — top left */}
        <span
          className={`absolute top-3 left-3 z-10 text-[11px] font-semibold px-2.5 py-1 rounded-full ${style.bg} ${style.text}`}
        >
          {product.store}
        </span>

        {/* Add to cart button — top right (dark green circle, matching ref screenshots) */}
        <button
          onClick={handleAddToCart}
          className={`absolute top-3 right-3 z-10 w-9 h-9 rounded-full shadow-md flex items-center justify-center transition-all duration-150 ${
            cartFeedback
              ? 'bg-[#E0F3E2] scale-90'
              : 'bg-[#2C742F] hover:bg-[#255f27] hover:scale-110'
          }`}
          aria-label={`Add ${product.name} to cart`}
        >
          {cartFeedback ? (
            <svg className="w-4 h-4 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          )}
        </button>

        {/* Organic / certification badge — bottom left */}
        {product.certifications?.includes('Organic') && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 shadow-sm">
            <svg className="w-3 h-3 text-[#2C742F]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-[#2C742F] text-[10px] font-semibold">Organic</span>
          </div>
        )}

        {/* Product image with smart fallback */}
        {!imgFailed && product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            unoptimized
            onError={() => setImgFailed(true)}
          />
        ) : (
          <SmartImageFallback name={product.name} />
        )}
      </div>

      {/* ── Card body ─────────────────────────────────────────────────── */}
      <div className="p-4 flex flex-col flex-1 gap-1.5">
        {/* Price row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-[#7B2D2D] text-white font-extrabold text-base px-2.5 py-1 rounded-lg">
            ${product.price.toFixed(2)}
          </span>
          {product.originalPrice && (
            <span className="text-[#1A1A1A]/40 line-through text-sm">
              ${product.originalPrice.toFixed(2)}
            </span>
          )}
          {product.discountPercent && product.discountPercent > 0 && (
            <span className="text-[#2C742F] text-xs font-bold">{product.discountPercent}% off</span>
          )}
        </div>

        {(unitPriceLabel || savingsLabel) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {unitPriceLabel && (
              <span className="text-[#2C742F] text-xs font-bold">{unitPriceLabel}</span>
            )}
            {savingsLabel && (
              <span className="text-[#2C742F] text-[10px] font-bold bg-[#E0F3E2] px-1.5 py-0.5 rounded-md">
                {savingsLabel}
              </span>
            )}
          </div>
        )}

        {/* Brand */}
        <p className="text-[#1A1A1A]/45 text-[11px] font-medium uppercase tracking-wider truncate">
          {product.brand}
        </p>

        {/* Name */}
        <h3
          className="text-[#1A1A1A] text-sm font-semibold leading-snug"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={product.name}
        >
          {product.name}
        </h3>

        {/* Rating + size */}
        <StarRating rating={product.rating} />
        {product.size && (
          <p className="text-[#1A1A1A]/40 text-xs">{product.size}</p>
        )}

        {/* Fulfillment badges — only shown when the store reports them */}
        {(product.pickupAvailable !== undefined || product.deliveryAvailable !== undefined) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {product.pickupAvailable && (
              <span className="text-[10px] font-semibold text-[#2C742F] bg-[#E0F3E2] px-2 py-0.5 rounded-full">
                Pickup
              </span>
            )}
            {product.deliveryAvailable && (
              <span className="text-[10px] font-semibold text-[#2C742F] bg-[#E0F3E2] px-2 py-0.5 rounded-full">
                Delivery
              </span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

