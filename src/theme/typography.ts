/**
 * Global typography scale — mirrors shopsmart_mobile/src/theme/typography.ts
 * role-for-role (display/h1/h2/h3/cardTitle/button/body/bodyMedium/caption/
 * overline), expressed as Tailwind class strings instead of RN TextStyle
 * objects, since every web component here is styled with Tailwind classes
 * directly. Font is Manrope (see layout.tsx) — the same free Google Fonts
 * substitute mobile uses in place of the proprietary "Amazon Ember" the
 * original design targeted, so both apps render identically rather than
 * mobile alone diverging from web's plain Inter.
 */
export const typography = {
  display: 'font-extrabold text-[34px] leading-[40px] tracking-[-0.5px] text-[#1A1A1A]',
  h1: 'font-extrabold text-[26px] leading-[32px] tracking-[-0.4px] text-[#1A1A1A]',
  h2: 'font-bold text-lg leading-6 text-[#1A1A1A]',
  h3: 'font-semibold text-[15px] leading-5 text-[#1A1A1A]',
  cardTitle: 'font-semibold text-[13.5px] leading-[18px] text-[#1A1A1A]',
  button: 'font-semibold text-[14.5px] leading-[18px] tracking-[0.1px]',
  body: 'font-normal text-sm leading-5 text-[#1A1A1A]',
  bodyMedium: 'font-medium text-sm leading-5 text-[#1A1A1A]',
  caption: 'font-medium text-[11.5px] leading-[15px] text-[#1A1A1A]/50',
  overline: 'font-bold text-[10.5px] leading-[14px] tracking-[0.6px] text-[#1A1A1A]/50 uppercase',
} as const;
