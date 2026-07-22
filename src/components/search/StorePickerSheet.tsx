'use client';

import { STORE_NAMES, type StoreName } from '@/types';
import { storeAccents } from '@/theme/colors';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (store: StoreName) => void;
}

/** Direct port of shopsmart_mobile's StorePickerSheet, as a web modal
 * (backdrop + centered panel) instead of a bottom sheet. */
export default function StorePickerSheet({ isOpen, onClose, onSelect }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-6 shadow-2xl">
        <h2 className="text-[#1A1A1A] font-bold text-lg mb-1">Search Within One Store</h2>
        <p className="text-[#1A1A1A]/50 text-sm mb-5">
          Browse one retailer&apos;s inventory directly — no cross-store comparison.
        </p>

        <div className="flex flex-col gap-2">
          {STORE_NAMES.map(store => {
            const accent = storeAccents[store];
            return (
              <button
                key={store}
                type="button"
                onClick={() => onSelect(store)}
                className="flex items-center gap-3 p-3 rounded-2xl border border-gray-100 hover:bg-gray-50 transition-colors text-left"
              >
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-extrabold shrink-0"
                  style={{ backgroundColor: accent.background, color: accent.text }}
                >
                  {store.slice(0, 2).toUpperCase()}
                </span>
                <span className="text-[#1A1A1A] font-semibold text-sm">{store}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full text-center text-[#1A1A1A]/45 text-sm font-medium py-2 hover:text-[#1A1A1A]/70 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
