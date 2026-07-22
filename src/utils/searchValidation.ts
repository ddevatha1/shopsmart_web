/**
 * Local, instant, no-network check for search queries that are clearly
 * outside this app's purpose (grocery shopping) — run before a search
 * request is ever sent. Direct port of
 * shopsmart_mobile/src/utils/searchValidation.ts.
 *
 * Deliberately default-allow: rather than trying to maintain an exhaustive
 * list of valid grocery items (impossible — uncommon items like "tahini" or
 * "xanthan gum", brand names, misspellings, and partial names all need to
 * keep working), a query is only rejected when it matches a short, curated
 * list of terms from domains this app obviously doesn't serve (electronics,
 * furniture, major appliances, vehicles, tools, apparel) or a short
 * inappropriate-language list. Everything else passes through untouched.
 */

export type SearchValidationResult =
  | { valid: true }
  | { valid: false; reason: 'unrelated' | 'inappropriate'; message: string };

const NON_GROCERY_TERMS = new Set([
  'iphone', 'ipad', 'ipod', 'macbook', 'laptop', 'computer', 'desktop', 'tablet',
  'tv', 'television', 'monitor', 'keyboard', 'mouse', 'headphone', 'headphones',
  'earbud', 'earbuds', 'charger', 'printer', 'camera', 'smartwatch', 'router',
  'speaker', 'xbox', 'playstation', 'nintendo', 'console', 'videogame', 'videogames',
  'table', 'chair', 'couch', 'sofa', 'desk', 'bed', 'mattress', 'dresser',
  'bookshelf', 'wardrobe', 'ottoman', 'recliner', 'nightstand',
  'refrigerator', 'fridge', 'washer', 'dryer', 'dishwasher',
  'car', 'truck', 'motorcycle', 'tire', 'tires', 'engine', 'transmission', 'windshield',
  'drill', 'hammer', 'wrench', 'screwdriver', 'ladder',
  'shirt', 'pants', 'jacket', 'sneakers', 'jeans', 'sweater', 'jewelry', 'handbag',
  'lamp', 'rug', 'mattress',
]);

const NON_GROCERY_PHRASES = ['vacuum cleaner', 'washing machine', 'cell phone'];

const INAPPROPRIATE_TERMS = new Set([
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'piss',
  'nigger', 'faggot', 'retard', 'whore', 'slut',
]);

function normalize(query: string): string {
  return query.toLowerCase().trim();
}

function singularize(word: string): string {
  return word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word;
}

function tokenize(query: string): string[] {
  return normalize(query)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

const UNRELATED_MESSAGE =
  "This doesn't look like a grocery item. Try searching for foods, drinks, or household essentials.";
const INAPPROPRIATE_MESSAGE = "Let's keep it grocery-related — try searching for a food or household item.";

export function validateSearchQuery(query: string): SearchValidationResult {
  const words = tokenize(query);
  if (words.length === 0) return { valid: true };

  for (const word of words) {
    if (INAPPROPRIATE_TERMS.has(word)) {
      return { valid: false, reason: 'inappropriate', message: INAPPROPRIATE_MESSAGE };
    }
  }

  const normalizedQuery = normalize(query);
  for (const phrase of NON_GROCERY_PHRASES) {
    if (normalizedQuery.includes(phrase)) {
      return { valid: false, reason: 'unrelated', message: UNRELATED_MESSAGE };
    }
  }

  for (const word of words) {
    if (NON_GROCERY_TERMS.has(word) || NON_GROCERY_TERMS.has(singularize(word))) {
      return { valid: false, reason: 'unrelated', message: UNRELATED_MESSAGE };
    }
  }

  return { valid: true };
}
