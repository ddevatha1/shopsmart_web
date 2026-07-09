/**
 * Dictionary-driven grocery image fallback.
 *
 * Returns a self-contained SVG data URI (not a hotlinked photo) so the result
 * is guaranteed to depict the right category by construction — there's no
 * risk of a keyword search returning a photo of the wrong product. Safe to
 * call from either a client component (e.g. ProductCard's onError handler)
 * or a server module (e.g. the search API route), since it has no DOM or
 * Next.js dependency.
 */

const BG = '<rect width="48" height="48" rx="8" fill="#F8FDF8"/>';

const ICONS: Record<string, string> = {
  dairy: `${BG}<rect x="12" y="6" width="24" height="36" rx="5" fill="#E0F3E2" stroke="#2C742F" stroke-width="1.5"/><rect x="16" y="10" width="16" height="7" rx="2" fill="#A8D5AA"/><circle cx="24" cy="30" r="5" fill="#A8D5AA"/>`,
  bread: `${BG}<ellipse cx="24" cy="28" rx="18" ry="11" fill="#F5DEB3" stroke="#C4923A" stroke-width="1.5"/><ellipse cx="24" cy="24" rx="14" ry="8" fill="#DEB887" stroke="#C4923A" stroke-width="1"/>`,
  egg: `${BG}<ellipse cx="24" cy="26" rx="12" ry="15" fill="#FFF9E6" stroke="#D4A040" stroke-width="1.5"/><ellipse cx="24" cy="29" rx="6" ry="7" fill="#FFD966" opacity="0.6"/>`,
  meat: `${BG}<rect x="8" y="18" width="32" height="16" rx="7" fill="#C0392B" opacity="0.75" stroke="#922B21" stroke-width="1.5"/><rect x="12" y="22" width="24" height="8" rx="3" fill="#E74C3C" opacity="0.45"/>`,
  fish: `${BG}<ellipse cx="22" cy="24" rx="14" ry="8" fill="#85C1E9" stroke="#2E86C1" stroke-width="1.5"/><path d="M36 24 L44 18 L44 30 Z" fill="#2980B9"/><circle cx="16" cy="22" r="2" fill="#1A5276"/>`,
  fruit: `${BG}<circle cx="24" cy="28" r="14" fill="#E74C3C" stroke="#C0392B" stroke-width="1.5"/><path d="M24 14 Q28 7 34 9" stroke="#2ECC71" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  vegetable: `${BG}<ellipse cx="24" cy="30" rx="16" ry="11" fill="#27AE60" stroke="#1E8449" stroke-width="1.5"/><path d="M24 30 Q14 18 18 8" stroke="#1E8449" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M24 30 Q34 18 30 8" stroke="#1E8449" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,
  coffee: `${BG}<rect x="12" y="22" width="22" height="18" rx="4" fill="#6F4E37" stroke="#4A3728" stroke-width="1.5"/><ellipse cx="23" cy="22" rx="11" ry="3.5" fill="#8B6651"/><path d="M34 28 Q40 28 40 33 Q40 38 34 38" stroke="#4A3728" stroke-width="1.5" fill="none"/>`,
  beverage: `${BG}<rect x="16" y="10" width="16" height="30" rx="7" fill="#AED6F1" stroke="#2E86C1" stroke-width="1.5"/><rect x="19" y="6" width="10" height="6" rx="2.5" fill="#AED6F1" stroke="#2E86C1" stroke-width="1.5"/><ellipse cx="24" cy="30" rx="6" ry="5" fill="#7FB3D3" opacity="0.5"/>`,
  cereal: `${BG}<rect x="12" y="8" width="24" height="32" rx="5" fill="#F5CBA7" stroke="#E59866" stroke-width="1.5"/><rect x="16" y="14" width="16" height="5" rx="2" fill="#E59866"/><circle cx="20" cy="26" r="2.5" fill="#E59866"/><circle cx="28" cy="26" r="2.5" fill="#E59866"/><circle cx="24" cy="32" r="2.5" fill="#E59866"/>`,
  generic: `${BG}<path d="M16 11V7a4 4 0 018 0v4M5 9h14l1 12H4L5 9z" fill="none" stroke="#2C742F" stroke-width="1" opacity="0.3" transform="translate(6 6) scale(1.5)"/>`,
};

// Order matters — first matching pattern wins, so more specific keyword
// groups (e.g. "egg") are checked before broad ones.
const CATEGORY_PATTERNS: Array<[RegExp, keyof typeof ICONS]> = [
  [/milk|dairy|creamer|cream|yogurt|yoghurt|butter|cheese/i, 'dairy'],
  [/bread|loaf|toast|bakery|bagel|baguette|sourdough|roll|bun|muffin|biscuit/i, 'bread'],
  [/\begg/i, 'egg'],
  [/chicken|turkey|poultry|beef|steak|meat|pork|lamb|bacon|sausage/i, 'meat'],
  [/fish|salmon|tuna|shrimp|seafood|cod|tilapia/i, 'fish'],
  [/apple|banana|orange|berry|berries|fruit|grape|peach|plum|mango|kiwi|pear/i, 'fruit'],
  [/spinach|kale|lettuce|salad|broccoli|vegetable|veggie|celery|carrot|tomato/i, 'vegetable'],
  [/coffee|espresso|latte/i, 'coffee'],
  [/water|soda|juice|beverage|drink|tea|lemonade/i, 'beverage'],
  [/cereal|oat|granola|grain|rice|pasta|noodle/i, 'cereal'],
];

function svgToDataUri(inner: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">${inner}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Maps a product name to a relevant, generated fallback image.
 * Never throws, never returns an empty string — worst case is the
 * generic grocery-bag icon.
 */
export function getGroceryFallbackImage(productName: string): string {
  const name = (productName ?? '').toLowerCase();
  for (const [pattern, key] of CATEGORY_PATTERNS) {
    if (pattern.test(name)) return svgToDataUri(ICONS[key]);
  }
  return svgToDataUri(ICONS.generic);
}
