'use client';

interface Props {
  activeFilterCount: number;
  onClear: () => void;
  onApply: () => void;
}

/** Direct port of shopsmart_mobile's FilterFooter. */
export default function FilterFooter({ activeFilterCount, onClear, onApply }: Props) {
  return (
    <div className="flex gap-3 px-6 pt-4 pb-5 border-t border-gray-100 bg-white">
      <button
        type="button"
        onClick={onClear}
        className="flex-1 border border-gray-100 rounded-xl py-3 text-[#1A1A1A] font-semibold text-sm hover:bg-gray-50 transition-colors"
      >
        Clear Filters
      </button>
      <button
        type="button"
        onClick={onApply}
        className="flex-[2] bg-[#2C742F] hover:bg-[#255f27] rounded-xl py-3 text-white font-semibold text-sm transition-colors"
      >
        Apply Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
      </button>
    </div>
  );
}
