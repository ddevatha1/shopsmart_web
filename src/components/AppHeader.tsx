'use client';

import { useRouter } from 'next/navigation';
import { useCartStore, cartItemCount } from '@/store/cartStore';
import { useUserStore } from '@/store/userStore';
import { useUiStore } from '@/store/uiStore';

interface Props {
  /** When set, renders a back button + title on the left (Compare,
   * Product Detail, Route) instead of the home page's logo + tagline. */
  back?: { onClick: () => void; title: string };
}

/**
 * The one persistent header every page in the app renders — logo (or a
 * back button + page title) on the left, cart and profile/sign-in access
 * on the right, always. Every routed page (Search, Compare, Product
 * Detail, Route) shares this instead of each reimplementing its own
 * cart/profile entry point, so those two overlays stay reachable from
 * anywhere in the app — the same guarantee mobile gets for free from its
 * persistent bottom-tab bar.
 */
export default function AppHeader({ back }: Props) {
  const router = useRouter();
  const user = useUserStore(s => s.user);
  const cartItems = useCartStore(s => s.items);
  const cartCount = cartItemCount(cartItems);
  const openAuth = useUiStore(s => s.openAuth);
  const openCart = useUiStore(s => s.openCart);
  const openProfile = useUiStore(s => s.openProfile);

  return (
    <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur z-20">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        {back ? (
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={back.onClick}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors shrink-0"
              aria-label="Back"
            >
              <svg className="w-4 h-4 text-[#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-lg font-bold text-[#1A1A1A] truncate">{back.title}</h1>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="text-xl font-extrabold text-[#1A1A1A] shrink-0"
            >
              Shop<span className="text-[#2C742F]">Smart</span>
            </button>
            <span className="hidden sm:inline text-xs font-medium text-[#2C742F] bg-[#E0F3E2] px-3 py-1 rounded-full shrink-0">
              4 stores · 1 search
            </span>
          </>
        )}

        <div className="flex items-center gap-2 ml-auto shrink-0">
          <button
            onClick={openCart}
            className="relative w-10 h-10 rounded-full bg-gray-100 hover:bg-[#E0F3E2] flex items-center justify-center transition-colors"
            aria-label="Open cart"
          >
            <svg className="w-5 h-5 text-[#1A1A1A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#2C742F] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>

          {user ? (
            <button
              onClick={openProfile}
              className="flex items-center gap-2 bg-[#E0F3E2] hover:bg-[#d0ebd2] px-3 py-2 rounded-full transition-colors"
              aria-label="Open profile"
            >
              <div className="w-6 h-6 bg-[#2C742F] rounded-full flex items-center justify-center text-white text-[10px] font-bold select-none">
                {user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <span className="text-[#2C742F] text-xs font-semibold hidden sm:inline">
                {user.name.split(' ')[0]}
              </span>
            </button>
          ) : (
            <button
              onClick={openAuth}
              className="bg-[#2C742F] hover:bg-[#255f27] text-white text-xs font-semibold px-4 py-2 rounded-full transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
