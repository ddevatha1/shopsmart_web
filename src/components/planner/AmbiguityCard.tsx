'use client';

import ChipRow from '@/components/filters/ChipRow';
import type { AmbiguityPrompt } from '@/types';

const NO_PREFERENCE = '__no_preference__';

interface Props {
  prompt: AmbiguityPrompt;
  /** `null` = "No Preference" selected, a subtypeId = that option chosen. */
  selected: string | null;
  onChange: (subtypeId: string | null) => void;
}

/** One compact clarification card — a label plus a single row of chips
 * (every subtype option + "No Preference"). Reuses ChipRow's existing
 * multi-select-shaped API in single-select mode (see ChipRow's own doc
 * comment: picking one clears the others is the caller's onToggle logic),
 * same pattern the app's Sort By filter already uses. */
export default function AmbiguityCard({ prompt, selected, onChange }: Props) {
  const chipValue = selected ?? NO_PREFERENCE;
  const options = [
    ...prompt.options.map(o => ({ value: o.subtypeId, label: o.label })),
    { value: NO_PREFERENCE, label: 'No Preference' },
  ];

  return (
    <div className="bg-gray-50 rounded-2xl p-4">
      <p className="text-[#1A1A1A] font-bold text-sm mb-3">{prompt.itemLabel}</p>
      <ChipRow
        options={options}
        selected={new Set([chipValue])}
        onToggle={value => onChange(value === NO_PREFERENCE ? null : value)}
      />
    </div>
  );
}
