'use client';

import type { StoreName } from '@/types';
import { storeAccents } from '@/theme/colors';

interface Props {
  selectedStore: StoreName | null;
  onOpenPicker: () => void;
  onClear: () => void;
}

/** Direct port of shopsmart_mobile's StoreModeBar — the entry point into
 * "Search Within One Store" mode, and the pill that shows it's active. */
export default function StoreModeBar({ selectedStore, onOpenPicker, onClear }: Props) {
  if (!selectedStore) {
    return (
      <button
        type="button"
        onClick={onOpenPicker}
        className="self-start text-[#2C742F] text-xs font-medium underline underline-offset-2 hover:text-[#255f27] transition-colors"
      >
        Search within one store
      </button>
    );
  }

  const accent = storeAccents[selectedStore];
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <span
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
        style={{ backgroundColor: accent.background, color: accent.text }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent.dot }} />
        Shopping at {selectedStore}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-[#2C742F] text-xs font-medium underline underline-offset-2 hover:text-[#255f27] transition-colors"
      >
        Compare Across Stores
      </button>
    </div>
  );
}
