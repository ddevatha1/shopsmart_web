'use client';

import { useEffect } from 'react';
import { User, CartItem } from '@/types';

interface ProfileTrayProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  cartItems: CartItem[];
  onSignOut: () => void;
}

function AvatarCircle({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div className="w-14 h-14 rounded-full bg-[#2C742F] flex items-center justify-center text-white font-bold text-xl shadow-md select-none">
      {initials}
    </div>
  );
}

export default function ProfileTray({
  isOpen,
  onClose,
  user,
  cartItems,
  onSignOut,
}: ProfileTrayProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const cartItemCount = cartItems.reduce((s, i) => s + i.quantity, 0);
  const uniqueStores = new Set(cartItems.map(i => i.product.store)).size;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="User Profile"
        className={`fixed top-0 right-0 h-full z-40 w-full sm:w-[380px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header strip */}
        <div className="bg-[#2C742F] px-6 pt-10 pb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <AvatarCircle name={user.name} />
              <div>
                <p className="text-white font-bold text-lg leading-tight">{user.name}</p>
                <p className="text-white/70 text-sm">{user.email}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors mt-1"
              aria-label="Close profile"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Account info */}
          <section>
            <h3 className="text-[#1A1A1A]/50 text-xs font-semibold uppercase tracking-wider mb-3">
              Account
            </h3>
            <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[#1A1A1A]/60 text-sm">Name</span>
                <span className="text-[#1A1A1A] text-sm font-semibold">{user.name}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[#1A1A1A]/60 text-sm">Email</span>
                <span className="text-[#1A1A1A] text-sm font-semibold truncate max-w-[160px]">{user.email}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[#1A1A1A]/60 text-sm">Home ZIP</span>
                <span className="text-[#1A1A1A] text-sm font-semibold">{user.zipcode || '—'}</span>
              </div>
            </div>
          </section>

          {/* Active cart summary */}
          <section>
            <h3 className="text-[#1A1A1A]/50 text-xs font-semibold uppercase tracking-wider mb-3">
              Active Cart
            </h3>
            {cartItemCount > 0 ? (
              <div className="bg-[#E0F3E2] rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#2C742F] text-sm font-semibold">
                    {cartItemCount} item{cartItemCount !== 1 ? 's' : ''}
                  </span>
                  <span className="text-[#2C742F] font-extrabold text-lg">
                    ${cartTotal.toFixed(2)}
                  </span>
                </div>
                <p className="text-[#2C742F]/70 text-xs">
                  Across {uniqueStores} store{uniqueStores !== 1 ? 's' : ''}
                </p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-[#1A1A1A]/40 text-sm">No items in cart yet.</p>
              </div>
            )}
          </section>

          {/* Search history */}
          <section>
            <h3 className="text-[#1A1A1A]/50 text-xs font-semibold uppercase tracking-wider mb-3">
              Recent Searches
            </h3>
            {user.searchHistory && user.searchHistory.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {user.searchHistory.slice(-10).reverse().map((term, i) => (
                  <span
                    key={i}
                    className="bg-gray-100 text-[#1A1A1A]/70 text-xs font-medium px-3 py-1.5 rounded-full"
                  >
                    {term}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-[#1A1A1A]/40 text-sm">No searches yet.</p>
            )}
          </section>

          {/* Saved config */}
          <section>
            <h3 className="text-[#1A1A1A]/50 text-xs font-semibold uppercase tracking-wider mb-3">
              Preferences
            </h3>
            <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center justify-between">
              <span className="text-[#1A1A1A]/60 text-sm">Price order</span>
              <span className="text-[#2C742F] text-sm font-semibold flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                Low to High
              </span>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-6 py-5 space-y-3">
          <button
            onClick={() => {
              onSignOut();
              onClose();
            }}
            className="w-full border border-red-200 text-red-600 hover:bg-red-50 font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            Sign Out
          </button>
          <p className="text-center text-[#1A1A1A]/30 text-xs">
            ShopSmart &mdash; Compare grocery prices across 5 stores
          </p>
        </div>
      </aside>
    </>
  );
}
