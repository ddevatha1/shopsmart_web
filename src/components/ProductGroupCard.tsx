'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ProductGroup } from '@/services/comparisonService';
import { getGroceryFallbackImage } from '@/utils/groceryFallbackImage';

interface Props {
  group: ProductGroup;
  onClick: (group: ProductGroup) => void;
}

/**
 * Stage 1 category card — direct port of shopsmart_mobile's
 * ProductGroupCard. Deliberately shows only an image, a name, and a
 * neutral "N stores" subtitle: no price, no store name, no brand. Any of
 * those would make a cross-store category card read as store-specific,
 * which is the exact bug this whole comparison redesign fixed — real
 * price/store comparison starts on the Compare (Stage 2) page, not here.
 */
export default function ProductGroupCard({ group, onClick }: Props) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <article
      onClick={() => onClick(group)}
      className="group bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-black/8 hover:-translate-y-0.5 transition-all duration-200 flex flex-col cursor-pointer"
      role="button"
      tabIndex={0}
      aria-label={`Compare ${group.name} across ${group.subtitle}`}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(group); }}
    >
      <div className="relative aspect-square bg-[#F8FDF8] overflow-hidden">
        {!imgFailed && group.image_url ? (
          <Image
            src={group.image_url}
            alt={group.name}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            unoptimized
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not eligible for next/image optimization */}
            <img src={getGroceryFallbackImage(group.name)} alt="" className="w-12 h-12" />
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col gap-1">
        <h3
          className="text-[#1A1A1A] text-sm font-semibold leading-snug"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={group.name}
        >
          {group.name}
        </h3>
        <p className="text-[#2C742F] text-xs font-medium">{group.subtitle}</p>
      </div>
    </article>
  );
}
