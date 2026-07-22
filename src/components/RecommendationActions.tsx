'use client';

interface Props {
  /** Present only when the recommendation holds a direct reference to a
   * real product it can navigate straight to. Omit to render no "See
   * Product" action. */
  onSeeProduct?: () => void;
  /** Present only when adding the referenced product directly makes
   * sense for this recommendation. Omit to render no "Add to Cart" action. */
  onAddToCart?: () => void;
}

/**
 * The shared action row for any recommendation surface that references a
 * specific product — the Product Detail substitution box and (later) the
 * Advisor card both render through this. Direct port of
 * shopsmart_mobile's RecommendationActions.
 */
export default function RecommendationActions({ onSeeProduct, onAddToCart }: Props) {
  if (!onSeeProduct && !onAddToCart) return null;
  return (
    <div className="flex items-center gap-2 mt-2">
      {onSeeProduct && (
        <button
          type="button"
          onClick={onSeeProduct}
          className="border border-gray-100 rounded-full px-3.5 py-2 text-[#1A1A1A] font-bold text-xs hover:border-[#2C742F] transition-colors"
        >
          See Product
        </button>
      )}
      {onAddToCart && (
        <button
          type="button"
          onClick={onAddToCart}
          className="bg-[#2C742F] hover:bg-[#255f27] text-white rounded-full w-8 h-8 flex items-center justify-center transition-colors shrink-0"
          aria-label="Add to cart"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      )}
    </div>
  );
}
