import type { ApiProduct, StoreName } from '../types';

/**
 * Direct port of shopsmart_mobile/src/services/priceHistoryService.ts
 * (localStorage instead of AsyncStorage — same JSON shape otherwise).
 *
 * The app's only source of "price history": a running, real, locally
 * recorded log of prices this browser has actually seen — one entry per
 * search result, ever. Not global market data, not fabricated — genuinely
 * observed prices, timestamped as they're returned by `/api/search`. A
 * fresh browser has none, and every stat below refuses to render anything
 * until there are enough real observations to say something true.
 */
const STORAGE_KEY = 'shopsmart_price_history';
const MAX_OBSERVATIONS_PER_PRODUCT = 30;
const MAX_OBSERVATION_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
const MIN_OBSERVATIONS_FOR_STATS = 2;

export interface PriceObservation {
  price: number;
  timestamp: number;
}

type StoreObservations = Partial<Record<StoreName, PriceObservation[]>>;
type HistoryLog = Record<string, StoreObservations>;

// Words that describe the product but not what it fundamentally is —
// stripped so "Organic Whole Milk, Half Gallon" and "Whole Milk 64 fl oz"
// (same product, different store listing conventions) key to the same
// entry. Deliberately smaller/looser than the backend's search-relevance
// dictionaries — this only needs "close enough to be the same
// shopping-list item," not exact catalog matching.
const NOISE_WORDS = new Set([
  'organic', 'natural', 'fresh', 'the', 'a', 'an', 'of', 'with', 'and', 'grade', 'select',
]);
const UNIT_PATTERN = /\b\d+(\.\d+)?\s*(oz|fl|lb|lbs|pound|pounds|g|gram|grams|kg|ml|l|liter|gal|gallon|qt|pt|ct|count|pk|pack)\b/gi;

/** Normalizes a product name to a stable key so the same real-world item
 * matches across size/format variations in a store's own listing text. */
export function normalizeProductName(name: string): string {
  const withoutUnits = name.toLowerCase().replace(UNIT_PATTERN, ' ');
  const words = withoutUnits
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !NOISE_WORDS.has(w) && !/^\d+$/.test(w));
  return [...new Set(words)].sort().join(' ');
}

function loadLog(): HistoryLog {
  if (typeof window === 'undefined') return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as HistoryLog;
  } catch {
    return {};
  }
}

function saveLog(log: HistoryLog): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

/** Records one observation per product in a fresh search response — call
 * this exactly once per `/api/search` result set (see searchStore.ts).
 * Prunes aggressively (age + count cap) so the log never grows unbounded
 * on a browser that searches often. */
export function recordObservations(products: ApiProduct[]): void {
  if (products.length === 0) return;
  const log = loadLog();
  const now = Date.now();
  const cutoff = now - MAX_OBSERVATION_AGE_MS;

  for (const product of products) {
    const key = normalizeProductName(product.name);
    if (!key) continue;
    const forProduct = log[key] ?? {};
    const forStore = (forProduct[product.store] ?? []).filter((o) => o.timestamp >= cutoff);
    forStore.push({ price: product.price, timestamp: now });
    forProduct[product.store] = forStore.slice(-MAX_OBSERVATIONS_PER_PRODUCT);
    log[key] = forProduct;
  }

  saveLog(log);
}

export interface PriceStats {
  current: number;
  average: number;
  lowest: number;
  highest: number;
  trend: 'up' | 'down' | 'flat';
  changePercent: number;
  /** Oldest-to-newest observed prices, capped short for a compact
   * sparkline. */
  sparkline: number[];
  observationCount: number;
}

/** Real stats from this browser's own observation log for `product` at its
 * own store — null when there isn't enough real history yet to say
 * anything meaningful (fewer than two observations). */
export function getStats(product: Pick<ApiProduct, 'name' | 'store' | 'price'>): PriceStats | null {
  const log = loadLog();
  const key = normalizeProductName(product.name);
  const observations = (log[key]?.[product.store] ?? []).slice().sort((a, b) => a.timestamp - b.timestamp);
  if (observations.length < MIN_OBSERVATIONS_FOR_STATS) return null;

  const prices = observations.map((o) => o.price);
  const average = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const lowest = Math.min(...prices);
  const highest = Math.max(...prices);
  const current = product.price;
  const changePercent = average > 0 ? Math.round(((current - average) / average) * 100) : 0;

  return {
    current,
    average: Math.round(average * 100) / 100,
    lowest,
    highest,
    trend: changePercent <= -3 ? 'down' : changePercent >= 3 ? 'up' : 'flat',
    changePercent,
    sparkline: prices.slice(-10),
    observationCount: observations.length,
  };
}

/** All stores this browser has observed prices for the same normalized
 * product at — the real cross-store data advisorService's "worth the
 * extra stop" and substitutionService read from. */
export function getCrossStoreObservations(productName: string): StoreObservations {
  const log = loadLog();
  return log[normalizeProductName(productName)] ?? {};
}

/** Latest known price for `productName` at `store`, or null if this
 * browser has never seen it. */
export function getLatestPrice(productName: string, store: StoreName): number | null {
  const observations = getCrossStoreObservations(productName);
  const forStore = observations[store];
  if (!forStore || forStore.length === 0) return null;
  return forStore[forStore.length - 1].price;
}
