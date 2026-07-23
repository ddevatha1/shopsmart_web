'use client';

import { useState, useEffect } from 'react';
import { User } from '@/types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuth: (user: User) => void;
  /** Which tab to open on — defaults to 'signin' (every pre-existing call
   * site's behavior). The onboarding overlay's "Get Started" is the only
   * caller that passes 'signup'. Parent re-mounts this component via a
   * `key` prop on open (see GlobalOverlays), so this only ever needs to
   * seed the initial `mode` state, never react to being changed live. */
  initialMode?: 'signin' | 'signup';
}

const LS_ACCOUNTS_KEY = 'shopsmart_accounts';

function loadAccounts(): Record<string, Omit<User, 'id'>> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(LS_ACCOUNTS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveAccount(user: User): void {
  const accounts = loadAccounts();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, ...rest } = user;
  accounts[user.email.toLowerCase()] = rest;
  localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(accounts));
}

export default function AuthModal({ isOpen, onClose, onAuth, initialMode = 'signin' }: AuthModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  // Form fields reset naturally on each open via the `key` prop set by the parent.
  // (page.tsx: <AuthModal key={authOpen ? 'auth-open' : 'auth-closed'} .../>)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const switchMode = (next: 'signin' | 'signup') => {
    setAnimating(true);
    setTimeout(() => {
      setMode(next);
      setFieldError(null);
      setAnimating(false);
    }, 150);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    const trimEmail = email.trim().toLowerCase();
    if (!trimEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimEmail)) {
      setFieldError('Please enter a valid email address.');
      return;
    }

    if (mode === 'signup') {
      if (!name.trim()) {
        setFieldError('Please enter your name.');
        return;
      }
      if (!/^\d{5}$/.test(zipcode)) {
        setFieldError('Please enter a valid 5-digit ZIP code.');
        return;
      }
      const accounts = loadAccounts();
      if (accounts[trimEmail]) {
        setFieldError('An account with this email already exists. Sign in instead.');
        return;
      }
      const newUser: User = {
        id: `u_${Date.now()}`,
        name: name.trim(),
        email: trimEmail,
        zipcode: zipcode.trim(),
        searchHistory: [],
      };
      saveAccount(newUser);
      onAuth(newUser);
      onClose();
    } else {
      const accounts = loadAccounts();
      const record = accounts[trimEmail];
      if (!record) {
        setFieldError('No account found with that email. Create one instead.');
        return;
      }
      const user: User = { id: `u_${Date.now()}`, ...record };
      onAuth(user);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'signin' ? 'Sign In' : 'Create Account'}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Green top bar */}
        <div className="bg-[#2C742F] px-8 pt-8 pb-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xl font-extrabold tracking-tight">
              Shop<span className="text-[#A8D5AA]">Smart</span>
            </span>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <h2 className="text-2xl font-bold">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-white/70 text-sm mt-1">
            {mode === 'signin'
              ? 'Sign in to access your saved carts and search history.'
              : 'Save carts across all five stores and track price history.'}
          </p>
        </div>

        {/* Toggle tabs */}
        <div className="flex border-b border-gray-100">
          <button
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              mode === 'signin'
                ? 'text-[#2C742F] border-b-2 border-[#2C742F]'
                : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]'
            }`}
            onClick={() => switchMode('signin')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              mode === 'signup'
                ? 'text-[#2C742F] border-b-2 border-[#2C742F]'
                : 'text-[#1A1A1A]/50 hover:text-[#1A1A1A]'
            }`}
            onClick={() => switchMode('signup')}
          >
            Create Account
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className={`px-8 py-6 space-y-4 transition-opacity duration-150 ${
            animating ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/30 focus:outline-none focus:border-[#2C742F] focus:ring-2 focus:ring-[#2C742F]/15 transition-all"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/30 focus:outline-none focus:border-[#2C742F] focus:ring-2 focus:ring-[#2C742F]/15 transition-all"
              autoComplete="email"
              required
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-[#1A1A1A]/60 uppercase tracking-wider mb-1.5">
                Home ZIP Code
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={zipcode}
                onChange={e => setZipcode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="78701"
                maxLength={5}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-[#1A1A1A] placeholder-[#1A1A1A]/30 focus:outline-none focus:border-[#2C742F] focus:ring-2 focus:ring-[#2C742F]/15 transition-all"
              />
            </div>
          )}

          {fieldError && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-red-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-red-700 text-xs">{fieldError}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-[#2C742F] hover:bg-[#255f27] text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
          >
            {mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          <p className="text-center text-xs text-[#1A1A1A]/40">
            {mode === 'signin' ? (
              <>
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-[#2C742F] font-semibold hover:underline"
                >
                  Sign up free
                </button>
              </>
            ) : (
              <>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-[#2C742F] font-semibold hover:underline"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}
