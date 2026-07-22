'use client';

import { useEffect, useState } from 'react';

// Deliberately store-agnostic — no store names, no per-store status, no
// props at all. A single unified "searching" experience that works
// identically whether 4 stores are being queried or 40; adding a store
// never touches this component. Replaces the old per-store ScannerTray
// grid, same as shopsmart_mobile's SearchProgress replaced its ScannerTray
// equivalent — see that component for the sibling implementation (built
// with Reanimated there; plain CSS keyframes here, since this app has no
// animation library installed and the previous ScannerTray was already
// pure Tailwind/CSS).
const MESSAGES = [
  'Searching nearby grocery stores…',
  'Comparing prices…',
  'Looking for fresh options…',
  "Gathering today's products…",
  'Organizing your results…',
  'Checking available items…',
  'Finding the best matches…',
];

const MESSAGE_INTERVAL_MS = 2400;

/** A single centered, tasteful "searching" state: a gently pulsing icon
 * badge, a staggered three-dot loop, and a rotating status message that
 * crossfades — no fake per-store progress, no skeleton grid that grows
 * with the store count. */
export function SearchProgress() {
  const [messageIndex, setMessageIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const fadeOut = setInterval(() => setVisible(false), MESSAGE_INTERVAL_MS);
    return () => clearInterval(fadeOut);
  }, []);

  // Swap the message only once the crossfade-out has finished, then fade
  // back in — mirrors the mobile version's opacity-out → swap → opacity-in
  // sequencing so the text never pops mid-fade.
  useEffect(() => {
    if (visible) return;
    const swap = setTimeout(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
      setVisible(true);
    }, 240);
    return () => clearTimeout(swap);
  }, [visible]);

  return (
    <div className="flex flex-col items-center gap-4 py-16">
      <div className="w-16 h-16 rounded-full bg-[#E0F3E2] flex items-center justify-center animate-search-pulse">
        <svg className="w-6 h-6 text-[#2C742F]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m2.1-5.15a7.25 7.25 0 11-14.5 0 7.25 7.25 0 0114.5 0z" />
        </svg>
      </div>

      <p
        className="text-[#1A1A1A] text-sm font-medium text-center px-8 transition-opacity duration-[240ms]"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {MESSAGES[messageIndex]}
      </p>

      <div className="flex gap-2 mt-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#2C742F] animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#2C742F] animate-bounce" style={{ animationDelay: '160ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-[#2C742F] animate-bounce" style={{ animationDelay: '320ms' }} />
      </div>
    </div>
  );
}
