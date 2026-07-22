'use client';

import { useState } from 'react';

interface Props {
  onShare: () => void | Promise<void>;
  onSkip: () => void;
}

/**
 * Pre-permission explainer shown once per browser session before route
 * planning falls back to the browser's own low-context location prompt —
 * a raw "example.com wants to know your location" dialog gives shoppers no
 * reason to say yes, so this explains *why* first (a precise starting
 * point for driving directions, instead of a ZIP-code centroid), the same
 * "explain first" pattern StorePickerSheet uses for store selection.
 * Skipping is always one tap away — route planning still works from the
 * saved ZIP code either way (see tripService.planShoppingTrip).
 */
export default function LocationPermissionModal({ onShare, onSkip }: Props) {
  const [requesting, setRequesting] = useState(false);

  const handleShare = async () => {
    setRequesting(true);
    await onShare();
    setRequesting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-6 shadow-2xl">
        <div className="w-12 h-12 bg-[#E0F3E2] rounded-full flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </div>
        <h2 className="text-[#1A1A1A] font-bold text-lg mb-1">Use your exact location?</h2>
        <p className="text-[#1A1A1A]/55 text-sm mb-5">
          Sharing your precise location gives a much more accurate starting point for
          driving directions and arrival times than your saved ZIP code alone. It&apos;s
          only used to plan this route — never stored or shared.
        </p>

        <button
          type="button"
          onClick={handleShare}
          disabled={requesting}
          className="w-full bg-[#2C742F] hover:bg-[#255f27] disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          {requesting ? 'Getting your location…' : 'Share Precise Location'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={requesting}
          className="mt-2 w-full text-center text-[#1A1A1A]/45 text-sm font-medium py-2.5 hover:text-[#1A1A1A]/70 transition-colors disabled:opacity-60"
        >
          Use my saved ZIP instead
        </button>
      </div>
    </div>
  );
}
