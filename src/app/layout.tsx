import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import GlobalOverlays from '@/components/GlobalOverlays';
import './globals.css';

// Manrope, not Inter — matches shopsmart_mobile's font exactly (see
// theme/typography.ts for why Manrope specifically). Loading every weight
// the typography scale actually uses.
const manrope = Manrope({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: "ShopSmart — Compare Grocery Prices Instantly",
  description:
    "Compare prices across Trader Joe's, Sprouts, Kroger, Aldi, and Albertsons in one search.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.className} antialiased`}>
        {children}
        <GlobalOverlays />
      </body>
    </html>
  );
}
