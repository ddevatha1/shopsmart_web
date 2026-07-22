'use client';

export interface ChipOption {
  value: string;
  label: string;
}

interface Props {
  options: ChipOption[];
  /** Which values are currently selected — a Set so callers can share the
   * exact selection state a filter facet already keeps (see
   * ComparisonFilters.attributes) without converting back and forth. */
  selected: Set<string>;
  onToggle: (value: string) => void;
}

/** A compact, wrapping row of toggle chips — direct port of
 * shopsmart_mobile's ChipRow. Always multi-select at this component's
 * level; Sort By's single-select behavior (picking one clears the others)
 * is the caller's onToggle logic, not a separate mode here. */
export default function ChipRow({ options, selected, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(option => {
        const isSelected = selected.has(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
            className={`border rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors ${
              isSelected
                ? 'bg-[#2C742F] border-[#2C742F] text-white'
                : 'bg-white border-gray-100 text-[#1A1A1A] hover:border-[#2C742F]'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
