'use client';

import type { QueryCorrectionInfo } from '@/types';

interface Props {
  correction: QueryCorrectionInfo;
  /** Re-runs the search using the literal original query, bypassing
   * correction entirely — the escape hatch a 'moderate'-confidence
   * correction always pairs with, per "never silently replace a query with
   * a completely different meaning." */
  onSearchOriginal: (original: string) => void;
}

/**
 * Surfaces the server's query-correction result (see
 * services/queryCorrection.ts). Both confidence levels already searched
 * using the corrected term by the time this renders — they differ only in
 * how assertively that's communicated:
 *  - 'high': a quiet, already-decided statement.
 *  - 'moderate': phrased as a question, paired with a visible way back to
 *    exactly what was typed.
 */
export default function DidYouMeanBanner({ correction, onSearchOriginal }: Props) {
  if (correction.level === 'high') {
    return (
      <p className="text-[#1A1A1A]/55 text-sm mb-4">
        Did you mean:{' '}
        <span className="font-semibold text-[#1A1A1A]">{correction.corrected}</span>
      </p>
    );
  }

  return (
    <p className="text-[#1A1A1A]/55 text-sm mb-4">
      Did you mean <span className="font-semibold text-[#1A1A1A]">{correction.corrected}</span>?{' '}
      <button
        type="button"
        onClick={() => onSearchOriginal(correction.original)}
        className="text-[#2C742F] hover:underline font-medium"
      >
        Search instead for &ldquo;{correction.original}&rdquo;
      </button>
    </p>
  );
}
