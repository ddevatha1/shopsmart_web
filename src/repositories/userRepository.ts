import type { User } from '../types';

/** The *current session's* live user object (including in-session search
 * history updates), kept separate from the accounts database in
 * authRepository — direct port of shopsmart_mobile's userRepository.ts. */
const USER_KEY = 'shopsmart_user';

export const userRepository = {
  async loadCurrentUser(): Promise<User | null> {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  async saveCurrentUser(user: User | null): Promise<void> {
    if (typeof window === 'undefined') return;
    if (user === null) {
      window.localStorage.removeItem(USER_KEY);
    } else {
      window.localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },
};
