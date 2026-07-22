'use client';

import type { ApiProduct } from '@/types';
import type { StoreSection as StoreSectionData, EnrichedListing } from '@/services/comparisonService';
import ProductCard from '@/components/ProductCard';
import { storeAccents } from '@/theme/colors';
import { formatMiles } from '@/utils/geo';

interface Props {
  section: StoreSectionData;
  onPressListing: (listing: EnrichedListing) => void;
  onAddToCart: (product: ApiProduct) => void;
}

/** One store's browsable aisle within a product comparison — direct port
 * of shopsmart_mobile's StoreSection, laid out as a horizontally
 * scrollable row instead of a vertical list. Every product this store
 * carries for the category shows up here, not just its single cheapest
 * listing. */
export default function StoreSection({ section, onPressListing, onAddToCart }: Props) {
  const accent = storeAccents[section.store];

  return (
    <div className="mb-7">
      <div className="flex items-center gap-2.5 px-1 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: accent.background }}
        >
          <span className="text-xs font-extrabold" style={{ color: accent.text }}>
            {section.store.slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[#1A1A1A] text-[15px] font-semibold">{section.store}</p>
          <p className="text-[#1A1A1A]/50 text-xs mt-0.5">
            {section.distanceMiles != null ? `${formatMiles(section.distanceMiles)} · ` : ''}
            {section.listings.length} option{section.listings.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-5 px-1 mb-3">
        {section.bestUnitPrice && <Stat label="Best Unit Price" value={section.bestUnitPrice.label} />}
        <Stat label="From" value={`$${section.bestPackagePrice.toFixed(2)}`} />
        <Stat label="Organic" value={section.organicAvailable ? 'Yes' : 'No'} />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-1 px-1 [scrollbar-width:thin]">
        {section.listings.map(listing => (
          <div key={listing.product.id} className="w-44 shrink-0">
            <ProductCard
              product={listing.product}
              onClick={() => onPressListing(listing)}
              onAddToCart={() => onAddToCart(listing.product)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[#1A1A1A] font-bold text-[12.5px]">{value}</span>
      <span className="text-[#1A1A1A]/40 text-[10.5px]">{label}</span>
    </div>
  );
}
