import type { StoreName } from '../types';

/**
 * ShopSmart brand palette — the single source of truth for both apps.
 * These are the same hex values shopsmart_mobile's theme/colors.ts copied
 * from this app's own hardcoded literals; centralizing them here (instead
 * of leaving them scattered across page.tsx/ProductCard.tsx/etc.) is what
 * keeps the two apps visually identical going forward.
 */
export const colors = {
  green: '#2C742F',
  greenDark: '#255F27', // hover/active state
  mint: '#E0F3E2',
  mintDark: '#D0EBD2', // hover state
  charcoal: '#1A1A1A',
  priceBadge: '#7B2D2D',
  imageBackground: '#F8FDF8',
  borderGray: '#F3F4F6', // Tailwind gray-100
  amber: '#FBBF24',
  errorRed: '#EF4444',
  errorBg: '#FEF2F2',
  errorBorder: '#FECACA',
  panelBg: '#F9FAFB',
  white: '#FFFFFF',
};

export interface StoreAccent {
  background: string;
  text: string;
  dot: string;
}

/** Tailwind rose/emerald/sky/cyan 100/500/700 shades, as hex — needed
 * wherever a store accent is used outside a Tailwind class string (map
 * pins, canvas contexts, inline styles). */
export const storeAccents: Record<StoreName, StoreAccent> = {
  "Trader Joe's": { background: '#FFE4E6', text: '#BE123C', dot: '#F43F5E' },
  Sprouts: { background: '#D1FAE5', text: '#047857', dot: '#10B981' },
  Kroger: { background: '#E0F2FE', text: '#0369A1', dot: '#0284C7' },
  Aldi: { background: '#CFFAFE', text: '#0E7490', dot: '#0E7490' },
  Albertsons: { background: '#EDE9FE', text: '#6D28D9', dot: '#7C3AED' },
};
