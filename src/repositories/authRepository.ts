import type { User } from '../types';

/**
 * Direct port of shopsmart_mobile/src/repositories/authRepository.ts, itself
 * a port of this app's own AuthModal.tsx — there is no real backend auth
 * endpoint: accounts are a JSON map persisted client-side (localStorage
 * here, AsyncStorage there), keyed by lowercased email, storing everything
 * except `id` (a fresh id is minted per sign-in, `u_${Date.now()}`).
 */
export class AuthError extends Error {}

type AccountRecord = Omit<User, 'id'>;

const ACCOUNTS_KEY = 'shopsmart_accounts';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_PATTERN = /^\d{5}$/;

function loadAccounts(): Record<string, AccountRecord> {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(ACCOUNTS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAccounts(accounts: Record<string, AccountRecord>): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

function newUserId(): string {
  return `u_${Date.now()}`;
}

export const authRepository = {
  async signUp(params: { name: string; email: string; zipcode: string }): Promise<User> {
    const trimmedEmail = params.email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      throw new AuthError('Please enter a valid email address.');
    }
    if (!params.name.trim()) {
      throw new AuthError('Please enter your name.');
    }
    if (!ZIP_PATTERN.test(params.zipcode)) {
      throw new AuthError('Please enter a valid 5-digit ZIP code.');
    }

    const accounts = loadAccounts();
    if (accounts[trimmedEmail]) {
      throw new AuthError('An account with this email already exists. Sign in instead.');
    }

    const user: User = {
      id: newUserId(),
      name: params.name.trim(),
      email: trimmedEmail,
      zipcode: params.zipcode.trim(),
      searchHistory: [],
    };

    accounts[trimmedEmail] = { name: user.name, email: user.email, zipcode: user.zipcode, searchHistory: user.searchHistory };
    saveAccounts(accounts);
    return user;
  },

  async signIn(params: { email: string }): Promise<User> {
    const trimmedEmail = params.email.trim().toLowerCase();
    if (!trimmedEmail || !EMAIL_PATTERN.test(trimmedEmail)) {
      throw new AuthError('Please enter a valid email address.');
    }

    const accounts = loadAccounts();
    const record = accounts[trimmedEmail];
    if (!record) {
      throw new AuthError('No account found with that email. Create one instead.');
    }

    return {
      id: newUserId(),
      name: record.name,
      email: record.email,
      zipcode: record.zipcode ?? '',
      searchHistory: record.searchHistory ?? [],
      weeklyBudget: record.weeklyBudget,
    };
  },

  async updateZipcode(email: string, zipcode: string): Promise<void> {
    if (!ZIP_PATTERN.test(zipcode)) {
      throw new AuthError('Please enter a valid 5-digit ZIP code.');
    }
    const trimmedEmail = email.trim().toLowerCase();
    const accounts = loadAccounts();
    if (accounts[trimmedEmail]) {
      accounts[trimmedEmail] = { ...accounts[trimmedEmail], zipcode };
      saveAccounts(accounts);
    }
  },

  async updateBudget(email: string, weeklyBudget: number | null): Promise<void> {
    const trimmedEmail = email.trim().toLowerCase();
    const accounts = loadAccounts();
    if (accounts[trimmedEmail]) {
      accounts[trimmedEmail] = { ...accounts[trimmedEmail], weeklyBudget: weeklyBudget ?? undefined };
      saveAccounts(accounts);
    }
  },
};
