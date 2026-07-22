import type { CartItem } from '../types';

/** Scoped per signed-in account (keyed by email) — a cart belongs to
 * whoever built it. Direct port of shopsmart_mobile's cartRepository.ts. */
function cartKey(ownerEmail: string): string {
  return `shopsmart_cart_${ownerEmail}`;
}

export const cartRepository = {
  async loadCart(ownerEmail: string): Promise<CartItem[]> {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(cartKey(ownerEmail));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CartItem[];
    } catch {
      return [];
    }
  },

  async saveCart(ownerEmail: string, items: CartItem[]): Promise<void> {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(cartKey(ownerEmail), JSON.stringify(items));
  },
};
