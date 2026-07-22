/** Consistent spacing scale (px) — mirrors shopsmart_mobile/src/theme/metrics.ts
 * exactly. Tailwind's own spacing utilities cover most usage; these exist
 * for arbitrary-value classes (`p-[var(--space-lg)]`) and non-Tailwind
 * contexts (canvas/map layers, inline styles) that need the same numbers. */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

/** Consistent corner-radius scale (px). */
export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
};
