'use client';

interface Props {
  count: number;
  onClick: () => void;
}

/** Direct port of shopsmart_mobile's FilterTriggerButton. */
export default function FilterTriggerButton({ count, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 border border-gray-100 rounded-full px-4 py-2.5 hover:border-[#2C742F] transition-colors"
    >
      <svg className="w-4 h-4 text-[#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
      </svg>
      <span className="text-[#1A1A1A] text-sm font-medium">Filter &amp; Sort</span>
      {count > 0 && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#2C742F] text-white text-[11px] font-bold flex items-center justify-center">
          {count}
        </span>
      )}
    </button>
  );
}
