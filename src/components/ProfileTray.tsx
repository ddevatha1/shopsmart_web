'use client';

import { useEffect, useState } from 'react';
import { User, CartItem } from '@/types';
import { useUserStore } from '@/store/userStore';
import { useOnboardingStore } from '@/store/onboardingStore';
import { useUiStore } from '@/store/uiStore';
import { GROCERY_TAXONOMY } from '@/data/groceryTaxonomy';
import { getAllPreferences, clearPreference } from '@/services/plannerPreferenceService';

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

/** A saved-value row that's a plain display until clicked, then becomes an
 * inline edit form — direct port of shopsmart_mobile ProfileScreen's
 * ZipCodeRow/BudgetRow pattern (unified into one generic component since
 * both share the exact same edit/save/cancel shape). */
function EditableRow({
  label, value, placeholder, onSave, validate, keyboardFilter,
}: {
  label: string;
  value: string;
  placeholder: string;
  onSave: (draft: string) => void;
  validate: (draft: string) => boolean;
  keyboardFilter: (raw: string) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    return (
      <div className="bg-gray-50 rounded-2xl px-4 py-3">
        <span className="text-[#1A1A1A]/60 text-sm">{label}</span>
        <div className="flex items-center gap-2 mt-2">
          <input
            autoFocus
            value={draft}
            onChange={e => setDraft(keyboardFilter(e.target.value))}
            placeholder={placeholder}
            className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-[#1A1A1A] bg-white focus:outline-none focus:border-[#2C742F]"
          />
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-[#1A1A1A]/60 text-sm font-medium px-1"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!validate(draft)}
            onClick={() => { onSave(draft); setEditing(false); }}
            className="text-[#2C742F] text-sm font-bold px-1 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => { setDraft(value); setEditing(true); }}
      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-colors text-left"
    >
      <span className="text-[#1A1A1A]/60 text-sm">{label}</span>
      <span className="flex items-center gap-1.5 text-[#1A1A1A] text-sm font-semibold">
        {value || '—'}
        <svg className="w-3 h-3 text-[#1A1A1A]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </span>
    </button>
  );
}

function taxonomyLabel(taxonomyEntryId: string): string {
  return taxonomyEntryId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function subtypeLabel(taxonomyEntryId: string, subtypeId: string): string {
  if (subtypeId === 'no-preference') return 'No Preference';
  const entry = GROCERY_TAXONOMY.find(e => e.id === taxonomyEntryId);
  return entry?.subtypes.find(s => s.id === subtypeId)?.label ?? subtypeId;
}

export default function ProfileTray({
  isOpen,
  onClose,
  user,
  cartItems,
  onSignOut,
}: ProfileTrayProps) {
  const updateZipcode = useUserStore(s => s.updateZipcode);
  const updateBudget = useUserStore(s => s.updateBudget);
  const resetOnboarding = useOnboardingStore(s => s.resetOnboarding);
  const openOnboarding = useUiStore(s => s.openOnboarding);

  const [plannerPrefs, setPlannerPrefs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isOpen) return;
    getAllPreferences(user.email).then(setPlannerPrefs);
  }, [isOpen, user.email]);

  // Re-arms the Welcome overlay *and* every contextual hint (see
  // onboardingStore.resetOnboarding) then reopens it directly — stays
  // signed in throughout; OnboardingOverlay detects the existing session
  // and skips straight past account creation.
  const handleRestartOnboarding = async () => {
    await resetOnboarding();
    onClose();
    openOnboarding();
  };

  const handleClearPreference = async (taxonomyEntryId: string) => {
    await clearPreference(user.email, taxonomyEntryId);
    setPlannerPrefs(prev => {
      const next = { ...prev };
      delete next[taxonomyEntryId];
      return next;
    });
  };

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

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          <section>
            <h3 className="text-[#1A1A1A]/50 text-xs font-semibold uppercase tracking-wider mb-3">
              Account
            </h3>
            <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100 mb-2">
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[#1A1A1A]/60 text-sm">Name</span>
                <span className="text-[#1A1A1A] text-sm font-semibold">{user.name}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-[#1A1A1A]/60 text-sm">Email</span>
                <span className="text-[#1A1A1A] text-sm font-semibold truncate max-w-[160px]">{user.email}</span>
              </div>
            </div>
            <div className="space-y-2">
              <EditableRow
                label="Home ZIP"
                value={user.zipcode}
                placeholder="78701"
                validate={draft => /^\d{5}$/.test(draft)}
                keyboardFilter={raw => raw.replace(/\D/g, '').slice(0, 5)}
                onSave={draft => updateZipcode(draft)}
              />
              <EditableRow
                label="Weekly Budget"
                value={user.weeklyBudget != null ? `$${user.weeklyBudget.toFixed(0)}` : ''}
                placeholder="e.g. 90"
                validate={draft => draft === '' || (Number.isFinite(parseFloat(draft)) && parseFloat(draft) > 0)}
                keyboardFilter={raw => raw.replace(/[^0-9.]/g, '')}
                onSave={draft => updateBudget(draft === '' ? null : parseFloat(draft))}
              />
            </div>
          </section>

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

          <section>
            <h3 className="text-[#1A1A1A]/50 text-xs font-semibold uppercase tracking-wider mb-3">
              Grocery Preferences
            </h3>
            {Object.keys(plannerPrefs).length > 0 ? (
              <div className="bg-gray-50 rounded-2xl divide-y divide-gray-100">
                {Object.entries(plannerPrefs).map(([taxonomyEntryId, subtypeId]) => (
                  <div key={taxonomyEntryId} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-[#1A1A1A] text-sm font-semibold">{taxonomyLabel(taxonomyEntryId)}</p>
                      <p className="text-[#1A1A1A]/50 text-xs mt-0.5">{subtypeLabel(taxonomyEntryId, subtypeId)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleClearPreference(taxonomyEntryId)}
                      className="text-[#1A1A1A]/40 hover:text-red-600 text-xs font-medium transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <p className="text-[#1A1A1A]/40 text-sm">
                  No remembered choices yet — the Smart Shopping Planner will save them here as you use it.
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-gray-100 px-6 py-5 space-y-3">
          <button
            onClick={handleRestartOnboarding}
            className="w-full flex items-center justify-center gap-2 bg-gray-50 hover:bg-gray-100 text-[#2C742F] font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Restart Onboarding
          </button>
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
            ShopSmart &mdash; Compare grocery prices across 4 stores
          </p>
        </div>
      </aside>
    </>
  );
}
