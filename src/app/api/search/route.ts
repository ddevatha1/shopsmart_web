import { NextRequest, NextResponse } from 'next/server';
import { ApiProduct, SearchResponse, StoreStatus } from '@/types';
import { searchSproutsWithTimeout } from '@/services/sproutsLiveScraper';
import { searchKrogerWithTimeout } from '@/services/krogerLiveScraper';
import { searchTraderJoesWithTimeout } from '@/services/traderJoesLiveScraper';
import { searchAldiWithTimeout } from '@/services/aldiLiveScraper';
import { getGroceryFallbackImage } from '@/utils/groceryFallbackImage';

type StoreName = ApiProduct['store'];

const ALL_STORES: StoreName[] = ["Trader Joe's", 'Sprouts', 'Kroger', 'Aldi'];

// ─── Relevance scoring ───────────────────────────────────────────────────
// Words that don't define what a product IS — strip these when ranking.
const FILLER_WORDS = new Set([
  'organic', 'natural', 'fresh', 'premium', 'artisan', 'classic', 'raw', 'pure',
  'whole', 'grade', 'certified', 'farm', 'local', 'locally', 'grown', 'harvested',
  'non-gmo', 'kosher', 'vegan', 'gluten-free', 'gluten', 'free', 'usda', 'extra',
  'super', 'large', 'medium', 'small', 'mini', 'giant', 'jumbo', 'select', 'choice',
  'crisp', 'ripe', 'aged', 'roasted', 'toasted', 'smoked', 'baked', 'frozen',
  'a', 'an', 'the', 'of', 'and', 'with', 'in', 'from', 'for', 'no', 'low',
]);
// Words that indicate the query term is a *flavoring/ingredient* in another product,
// not the primary product itself (e.g. "Banana Yogurt" vs "Bananas").
const DERIVED_TYPE_WORDS = new Set([
  'yogurt', 'yoghurt', 'muffin', 'muffins', 'bread', 'cake', 'cakes',
  'cookie', 'cookies', 'chip', 'chips', 'juice', 'sauce', 'dip', 'dips',
  'smoothie', 'smoothies', 'shake', 'shakes', 'pudding', 'pie', 'pies',
  'bar', 'bars', 'candy', 'chocolate', 'powder', 'cereal', 'granola',
  'oatmeal', 'jam', 'jelly', 'preserve', 'preserves', 'syrup', 'extract',
  'spread', 'cream', 'gelato', 'sorbet', 'popsicle', 'pop',
  'pancake', 'waffle', 'waffles', 'crepe', 'tart', 'tarts', 'scone', 'scones',
  'roll', 'rolls', 'bun', 'buns', 'cracker', 'crackers', 'pretzel', 'pretzels',
  'glaze', 'frosting', 'topping', 'filling', 'drizzle', 'compote',
  'flavored', 'flavor', 'infused', 'bite', 'bites', 'crisp', 'crisps',
]);

// ─── NLP word similarity ─────────────────────────────────────────────────
// Sørensen–Dice bigram coefficient: a standard text-similarity measure that
// tolerates typos and irregular plurals (e.g. "tomato" vs "tomatoes",
// "leaf" vs "leaves") without treating unrelated words as matches.
function diceCoefficient(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigramCounts = (s: string) => {
    const counts = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bigram = s.slice(i, i + 2);
      counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }
    return counts;
  };
  const bigramsA = bigramCounts(a);
  const bigramsB = bigramCounts(b);
  let overlap = 0;
  for (const [bigram, count] of bigramsA) {
    const countB = bigramsB.get(bigram);
    if (countB) overlap += Math.min(count, countB);
  }
  return (2 * overlap) / (a.length - 1 + (b.length - 1));
}

const WORD_SIMILARITY_THRESHOLD = 0.7;

// True if two words denote the same concept: identical, simple plural, or
// similar enough (typo/irregular plural) per Dice coefficient. Deliberately
// strict — "milk" and "cream" score 0, so they are never treated as a match.
function wordsMatch(a: string, b: string): boolean {
  if (a === b || a === b + 's' || b === a + 's') return true;
  return diceCoefficient(a, b) >= WORD_SIMILARITY_THRESHOLD;
}

// Fraction of query words that have a matching word in the product name.
function queryCoverage(qWords: string[], nWords: string[]): number {
  const present = qWords.filter(qw => nWords.some(nw => wordsMatch(nw, qw)));
  return present.length / qWords.length;
}

/**
 * True if the product name shares at least one real word with the query.
 * Used to exclude products a store's own search returned that aren't
 * actually about what was searched for (e.g. "milk" pulling in "Chocolate
 * Whipped Light Cream" — no word overlap, so it should never surface).
 */
function isRelevantToQuery(query: string, name: string): boolean {
  const qWords = query.toLowerCase().trim().split(/\s+/);
  const nWords = name.toLowerCase().trim().split(/[\s\-/,()]+/).filter(Boolean);
  return queryCoverage(qWords, nWords) > 0;
}

/**
 * Returns 0–100: how closely a product name matches the search query.
 * Higher = show first. Secondary sort is price (ascending).
 */
function computeRelevance(query: string, name: string): number {
  const q = query.toLowerCase().trim();
  const n = name.toLowerCase().trim();
  const nWords = n.split(/[\s\-/,()]+/).filter(Boolean);
  const qWords = q.split(/\s+/);

  // Exact or near-exact name match (handle plurals both ways)
  const nBase = n.endsWith('s') ? n.slice(0, -1) : n;
  const qBase = q.endsWith('s') ? q.slice(0, -1) : q;
  if (nBase === qBase) return 100;

  // Check what fraction of query words appear in the name
  const coverage = queryCoverage(qWords, nWords);

  if (coverage < 1) {
    // Partial: not all query words found
    return coverage > 0 ? Math.round(coverage * 25) : 0;
  }

  // All query words present — score by position of first match in significant words
  const sigWords = nWords.filter(w => !FILLER_WORDS.has(w));
  const firstSigIdx = Math.max(
    0,
    sigWords.findIndex(nw => qWords.some(qw => wordsMatch(nw, qw))),
  );

  let score = Math.max(35, 85 - firstSigIdx * 12);

  // Single-word query: penalize if it appears as a flavoring in a derived product
  // e.g. "Banana Yogurt" scored lower than "Bananas" when query = "banana"
  if (qWords.length === 1 && firstSigIdx === 0 && sigWords.length > 1) {
    const nextSig = sigWords[1];
    if (DERIVED_TYPE_WORDS.has(nextSig)) score = Math.min(score, 52);
  }

  // Bonus for concise names: fewer extra significant words = more direct match
  const extra = sigWords.length - qWords.length;
  if (extra <= 0) score = Math.min(100, score + 10);
  else if (extra === 1) score = Math.min(100, score + 3);

  return score;
}

// ─── Food-only filter ───────────────────────────────────────────────────────
// Name-only food check — used to screen out non-grocery items from the live
// scraper/API results (Sprouts, Kroger, Trader Joe's).
const NON_FOOD_NAME_KEYWORDS = [
  'shampoo', 'conditioner', 'detergent', 'laundry', 'bleach', 'disinfect',
  'deodorant', 'lotion', 'moisturizer', 'sunscreen', 'toothpaste', 'mouthwash',
  'fertilizer', 'dog food', 'cat food', 'pet food',
  // Paper & household goods
  'toilet paper', 'paper towel', 'facial tissue', 'napkin', 'diaper', 'baby wipe',
  'wet wipe', 'dish soap', 'dishwasher detergent', 'fabric softener', 'stain remover',
  'air freshener', 'scented candle', 'trash bag', 'garbage bag', 'aluminum foil',
  'plastic wrap', 'parchment paper', 'storage bag',
  // Personal care & health
  'shaving cream', 'razor blade', 'soap', 'beauty bar', 'cleansing bar',
  'body wash', 'hand sanitizer',
  'first aid', 'bandage', 'multivitamin', 'dietary supplement', 'protein supplement',
  // Pet supplies
  'dog treat', 'cat treat', 'kitty litter', 'cat litter',
  // Cleaning supplies
  'all-purpose cleaner', 'glass cleaner', 'floor cleaner', 'bathroom cleaner',
  'toilet bowl cleaner',
  // Misc non-grocery
  'paper plate', 'paper cup', 'greeting card', 'gift card', 'magazine',
];

function isFoodProductName(name: string): boolean {
  const lower = name.toLowerCase();
  return !NON_FOOD_NAME_KEYWORDS.some(kw => lower.includes(kw));
}

// Fill in a keyword-matched category graphic for any product missing an
// image (the live scrapers don't always capture one).
function backfillMissingImages(products: ApiProduct[]): ApiProduct[] {
  return products.map(p =>
    p.image_url ? p : { ...p, image_url: getGroceryFallbackImage(p.name) },
  );
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { query?: string; zipcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const query = body.query?.trim();
  const zipcode = body.zipcode?.trim();

  if (!query || !zipcode) {
    return NextResponse.json(
      { error: '`query` and `zipcode` are required.' },
      { status: 400 },
    );
  }

  if (!/^\d{5}$/.test(zipcode)) {
    return NextResponse.json(
      { error: '`zipcode` must be a 5-digit US zip code.' },
      { status: 400 },
    );
  }

  // Run the live Trader Joe's scraper, live Sprouts scraper, live Kroger API,
  // and live Aldi API in parallel.
  // Total latency = max(traderJoesTime, sproutsTime, krogerTime, aldiTime).
  const [traderJoesResult, sproutsResult, krogerResult, aldiResult] = await Promise.allSettled([
    searchTraderJoesWithTimeout(query, 45_000), // includes storefront visit on first run
    searchSproutsWithTimeout(query, 55_000), // includes storefront visit on first run
    searchKrogerWithTimeout(query, zipcode, 15_000), // REST API, no browser
    searchAldiWithTimeout(query, zipcode, 15_000), // GraphQL API, postalCode is a real per-search field
  ]);

  const storeMap = new Map<StoreName, ApiProduct[]>();
  const storeErrors = new Map<StoreName, string>();

  if (traderJoesResult.status === 'fulfilled') {
    const relevant = traderJoesResult.value
      .filter(p => isFoodProductName(p.name))
      .filter(p => isRelevantToQuery(query, p.name));
    storeMap.set("Trader Joe's", relevant.slice(0, 12));
  } else {
    storeErrors.set("Trader Joe's", String(traderJoesResult.reason));
    console.warn("[Search] Trader Joe's scraper error:", traderJoesResult.reason);
  }

  if (sproutsResult.status === 'fulfilled') {
    const relevant = sproutsResult.value
      .filter(p => isFoodProductName(p.name))
      .filter(p => isRelevantToQuery(query, p.name));
    storeMap.set('Sprouts', backfillMissingImages(relevant).slice(0, 12));
  } else {
    storeErrors.set('Sprouts', String(sproutsResult.reason));
    console.warn('[Search] Sprouts scraper error:', sproutsResult.reason);
  }

  if (krogerResult.status === 'fulfilled') {
    const relevant = krogerResult.value
      .filter(p => isFoodProductName(p.name))
      .filter(p => isRelevantToQuery(query, p.name));
    storeMap.set('Kroger', relevant.slice(0, 12));
  } else {
    storeErrors.set('Kroger', String(krogerResult.reason));
    console.warn('[Search] Kroger API error:', krogerResult.reason);
  }

  if (aldiResult.status === 'fulfilled') {
    const relevant = aldiResult.value
      .filter(p => isFoodProductName(p.name))
      .filter(p => isRelevantToQuery(query, p.name));
    storeMap.set('Aldi', backfillMissingImages(relevant).slice(0, 12));
  } else {
    storeErrors.set('Aldi', String(aldiResult.reason));
    console.warn('[Search] Aldi API error:', aldiResult.reason);
  }

  const storeStatuses: StoreStatus[] = ALL_STORES.map(store => {
    const products = storeMap.get(store) ?? [];
    return {
      store,
      status: products.length > 0 ? 'success' : 'error',
      count: products.length,
      error: products.length === 0 ? (storeErrors.get(store) ?? 'No results found.') : undefined,
    };
  });

  const allProducts: ApiProduct[] = ALL_STORES.flatMap(store => storeMap.get(store) ?? []);

  // Sort by relevance first (higher = more on-topic), then by price (ascending)
  allProducts.sort((a, b) => {
    const ra = computeRelevance(query, a.name);
    const rb = computeRelevance(query, b.name);
    if (ra !== rb) return rb - ra; // more relevant first
    return a.price - b.price; // cheaper first within same relevance
  });

  const response: SearchResponse = { products: allProducts, storeStatuses };
  return NextResponse.json(response);
}
