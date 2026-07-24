'use client';

import { useEffect } from 'react';

/**
 * The app's single top-level error boundary (Next.js App Router's
 * `error.tsx` convention) — without this, a render-time exception anywhere
 * in the tree crashed to Next.js's default unstyled error screen with no
 * recovery short of a full reload. This catches it, shows a real recovery
 * screen, and lets the shopper retry in place via `reset()`; cart/account
 * data is unaffected since it only catches render/lifecycle errors, not
 * the async errors already handled locally by each screen's own
 * try/catch (see apiClient.ts's ApiError).
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[ErrorBoundary] Caught a render error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center bg-white">
      <svg className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
      </svg>
      <h1 className="text-lg font-bold text-[#1A1A1A]">Something went wrong</h1>
      <p className="text-sm text-[#1A1A1A]/60 max-w-sm">
        ShopSmart ran into an unexpected error. Your cart and account are safe — try again.
      </p>
      <button
        onClick={reset}
        className="mt-2 bg-[#2C742F] hover:bg-[#255f27] text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
      >
        Try Again
      </button>
    </div>
  );
}
