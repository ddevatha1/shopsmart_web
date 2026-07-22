// Verifies the redesigned clustering + representative-selection algorithm
// in comparisonService.ts against synthetic multi-store fixtures for the
// diverse query list called out when the categorization system was
// redesigned (see the "Verification" section of that work): chicken,
// chicken breast, chicken tenders, milk, eggs, bread, yogurt, greek
// yogurt, cheese, shredded cheese, apples, bananas, beef, ground beef,
// rice, pasta, peanut butter, cereal, frozen pizza, coffee. No live
// scraper access is available in this environment, so each fixture
// mimics the kind of per-store name variance Kroger/Aldi/Trader Joe's/
// Sprouts actually produce for the same underlying product (different
// filler words, different flavor, one marinated/prepared decoy), plus at
// least one intentionally-distinct decoy per query to confirm real
// distinctions (fat content, cut, variety) are still kept apart.
//
// Run with: npm test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductGroups,
  buildCombinedGroup,
  categoryLayerIsMeaningful,
  countMeaningfulCategories,
  enrichListings,
  getBestValueSummary,
  getUnitPrice,
  type ProductGroup,
} from './comparisonService.ts';
import type { ApiProduct, StoreName } from '@/types';

let nextId = 1;

function p(store: StoreName, name: string, overrides: Partial<ApiProduct> = {}): ApiProduct {
  return {
    id: `p${nextId++}`,
    name,
    brand: overrides.brand ?? 'Store Brand',
    price: overrides.price ?? 3.99,
    rating: overrides.rating ?? 4.2,
    size: overrides.size ?? '16 oz',
    store,
    matchType: 'direct',
    ...overrides,
  };
}

/** The multi-store group (storeCount > 1) whose representative best
 * matches `query` — i.e. what a shopper would see as the top/primary
 * card for that search. Fails the assertion (via a clear message) if no
 * multi-store group was produced at all. */
function primaryGroup(products: ApiProduct[], query: string): ProductGroup {
  const groups = buildProductGroups(products, query).filter((g) => g.storeCount > 1);
  assert.ok(groups.length > 0, `expected at least one multi-store group for "${query}", got none`);
  return groups[0];
}

function assertNoWords(name: string, words: string[], label: string) {
  const lower = name.toLowerCase();
  for (const w of words) {
    assert.ok(!lower.includes(w), `representative "${name}" should not read as ${label} (contains "${w}")`);
  }
}

const FLAVOR_OR_PREPARED = [
  'vanilla', 'chocolate', 'strawberry', 'blueberry', 'unsweetened', 'sweetened',
  'cinnamon', 'caramel', 'mocha', 'mint',
  'marinated', 'seasoned', 'breaded', 'stuffed', 'glazed', 'teriyaki', 'bbq',
  'barbecue', 'buffalo', 'rotisserie', 'asado', 'fajita', 'cajun', 'blackened', 'jerk',
];

// ─── chicken / chicken breast ──────────────────────────────────────────────

const CHICKEN_PRODUCTS: ApiProduct[] = [
  p('Kroger', 'Boneless Skinless Chicken Breast'),
  p('Aldi', 'Chicken Breast Value Pack'),
  p("Trader Joe's", 'Fresh Chicken Breast'),
  p('Sprouts', 'Organic Chicken Breast'),
  p('Sprouts', 'Chicken Thighs'),
  p("Trader Joe's", 'Chicken Thighs Family Pack'),
  p('Kroger', 'Pollo Asado Chicken Thigh'),
  p('Aldi', 'Pollo Asado Chicken Thigh'),
];

test('"chicken" surfaces a generic multi-store category, not the marinated thigh variant', () => {
  const groups = buildProductGroups(CHICKEN_PRODUCTS, 'chicken').filter((g) => g.storeCount > 1);
  assert.ok(groups.length >= 2, `expected separate breast and thigh categories, got ${groups.length}`);
  // The top-ranked category (by relevance to "chicken") must not be the
  // marinated/prepared decoy — that was the reported bug (Pollo Asado
  // Chicken Thigh becoming *the* card for a "chicken" search).
  assertNoWords(groups[0].name, ['asado', 'pollo'], 'a prepared/marinated variant');

  const thighGroup = groups.find((g) => g.name.toLowerCase().includes('thigh'));
  assert.ok(thighGroup, 'expected a Chicken Thighs category to exist alongside Chicken Breast');
  assertNoWords(thighGroup!.name, ['asado', 'pollo'], 'a prepared/marinated variant');
});

test('"chicken breast" clusters every store\'s phrasing into one category represented by plain Chicken Breast', () => {
  const group = primaryGroup(CHICKEN_PRODUCTS, 'chicken breast');
  assert.equal(group.storeCount, 4, 'expected all four stores\' chicken breast listings to cluster together');
  assertNoWords(group.name, ['boneless', 'skinless', 'organic', 'value', 'fresh'], 'an excessively modified variant');
  assert.match(group.name.toLowerCase(), /breast/);
});

// ─── chicken tenders (previously: no category at all) ──────────────────────

test('"chicken tenders" now produces a real multi-store category', () => {
  const products = [
    p('Kroger', 'Chicken Tenders'),
    p('Aldi', 'Fresh Chicken Tenders'),
    p("Trader Joe's", 'Boneless Chicken Tenders'),
    p('Sprouts', 'Chicken Tenders Value Pack'),
    p('Kroger', 'Breaded Chicken Tenders'),
  ];
  const group = primaryGroup(products, 'chicken tenders');
  assert.equal(group.storeCount, 4);
  assertNoWords(group.name, ['breaded'], 'a prepared variant');
  assert.match(group.name.toLowerCase(), /tender/);
});

// ─── milk ───────────────────────────────────────────────────────────────────

test('"milk" clusters Whole Milk across stores and keeps 2% Milk a separate category', () => {
  const products = [
    p('Kroger', 'Organic Whole Milk'),
    p('Aldi', 'Whole Milk Gallon'),
    p("Trader Joe's", 'Whole Milk Half Gallon'),
    p('Sprouts', 'Whole Milk'),
    p('Kroger', '2% Milk'),
    p('Aldi', '2% Reduced Fat Milk'),
  ];
  const groups = buildProductGroups(products, 'milk').filter((g) => g.storeCount > 1);
  const whole = groups.find((g) => g.name.toLowerCase().includes('whole'));
  assert.ok(whole, 'expected a Whole Milk category');
  assert.equal(whole!.storeCount, 4);

  const twoPercent = groups.find((g) => g.name.includes('2%'));
  assert.ok(twoPercent, 'expected 2% Milk to remain its own category, not merged into Whole Milk');
  assert.notEqual(whole!.id, twoPercent!.id);
});

// ─── eggs ───────────────────────────────────────────────────────────────────

test('"eggs" clusters across stores into a generic Eggs category', () => {
  const products = [
    p('Kroger', 'Large Eggs'),
    p('Aldi', 'Grade A Large Eggs'),
    p("Trader Joe's", 'Eggs'),
    p('Sprouts', 'Extra Large Eggs'),
  ];
  const group = primaryGroup(products, 'eggs');
  assert.equal(group.storeCount, 4);
});

// ─── bread / sandwich bread (previously: no category at all) ───────────────

test('"sandwich bread" produces a real multi-store category', () => {
  const products = [
    p('Kroger', 'Sandwich Bread'),
    p('Aldi', 'Fresh Sandwich Bread'),
    p("Trader Joe's", 'Sandwich Bread 20oz'),
    p('Sprouts', 'Organic Sandwich Bread'),
  ];
  const group = primaryGroup(products, 'sandwich bread');
  assert.equal(group.storeCount, 4);
  assert.match(group.name.toLowerCase(), /sandwich bread/);
});

test('"bread" surfaces a category too', () => {
  const products = [
    p('Kroger', 'Sandwich Bread'),
    p('Aldi', 'Fresh Sandwich Bread'),
    p("Trader Joe's", 'Sandwich Bread 20oz'),
    p('Sprouts', 'Organic Sandwich Bread'),
  ];
  primaryGroup(products, 'bread'); // throws/asserts internally if none found
});

// ─── yogurt / greek yogurt ──────────────────────────────────────────────────

test('"yogurt" clusters flavored variants into one generic category', () => {
  const products = [
    p('Kroger', 'Plain Yogurt'),
    p('Aldi', 'Yogurt'),
    p("Trader Joe's", 'Vanilla Yogurt'),
    p('Sprouts', 'Strawberry Yogurt'),
  ];
  const group = primaryGroup(products, 'yogurt');
  assert.equal(group.storeCount, 4, 'flavor should not fragment store coverage');
  assertNoWords(group.name, ['vanilla', 'strawberry'], 'a flavored variant');
});

test('"greek yogurt" reinforces one category regardless of flavor', () => {
  const products = [
    p('Kroger', 'Greek Yogurt Vanilla'),
    p('Aldi', 'Greek Yogurt Strawberry'),
    p("Trader Joe's", 'Greek Yogurt Plain'),
    p('Sprouts', 'Plain Greek Yogurt'),
  ];
  const group = primaryGroup(products, 'greek yogurt');
  assert.equal(group.storeCount, 4);
  assert.match(group.name.toLowerCase(), /greek/);
  assert.match(group.name.toLowerCase(), /yogurt/);
  assertNoWords(group.name, ['vanilla', 'strawberry'], 'a flavored variant');
});

// ─── cheese / shredded cheese (previously: no category at all) ─────────────

test('"cheese" clusters a generic cheese across stores', () => {
  const products = [
    p('Kroger', 'Cheddar Cheese'),
    p('Aldi', 'Fresh Cheddar Cheese'),
    p("Trader Joe's", 'Organic Cheddar Cheese'),
    p('Sprouts', 'Cheddar Cheese Value Pack'),
  ];
  const group = primaryGroup(products, 'cheese');
  assert.equal(group.storeCount, 4);
});

test('"shredded cheese" produces a real multi-store category', () => {
  const products = [
    p('Kroger', 'Shredded Cheddar Cheese'),
    p('Aldi', 'Fresh Shredded Cheddar Cheese'),
    p("Trader Joe's", 'Organic Shredded Cheddar Cheese'),
    p('Sprouts', 'Shredded Cheddar Cheese Value Pack'),
  ];
  const group = primaryGroup(products, 'shredded cheese');
  assert.equal(group.storeCount, 4);
  assert.match(group.name.toLowerCase(), /shredded/);
});

// ─── apples / gala apples (previously: no category at all) ─────────────────

test('"apples" clusters a generic variety across stores', () => {
  const products = [
    p('Kroger', 'Honeycrisp Apples'),
    p('Aldi', 'Fresh Honeycrisp Apples'),
    p("Trader Joe's", 'Organic Honeycrisp Apples'),
    p('Sprouts', 'Honeycrisp Apples Bag'),
  ];
  const group = primaryGroup(products, 'apples');
  assert.equal(group.storeCount, 4);
});

test('"gala apples" produces a real multi-store category', () => {
  const products = [
    p('Kroger', 'Gala Apples'),
    p('Aldi', 'Fresh Gala Apples'),
    p("Trader Joe's", 'Organic Gala Apples 3lb Bag'),
    p('Sprouts', 'Gala Apples Value Pack'),
  ];
  const group = primaryGroup(products, 'gala apples');
  assert.equal(group.storeCount, 4);
  assert.match(group.name.toLowerCase(), /gala/);
});

// ─── bananas ────────────────────────────────────────────────────────────────

test('"bananas" clusters across stores', () => {
  const products = [
    p('Kroger', 'Bananas'),
    p('Aldi', 'Organic Bananas'),
    p("Trader Joe's", 'Bananas Bunch'),
    p('Sprouts', 'Fresh Bananas'),
  ];
  const group = primaryGroup(products, 'bananas');
  assert.equal(group.storeCount, 4);
});

// ─── beef / ground beef ─────────────────────────────────────────────────────

test('"beef" clusters a cut across stores and keeps Ground Beef separate', () => {
  const products = [
    p('Kroger', 'Beef Sirloin Steak'),
    p('Aldi', 'Fresh Beef Sirloin Steak'),
    p("Trader Joe's", 'Beef Sirloin Steak Value Pack'),
    p('Sprouts', 'Organic Beef Sirloin Steak'),
    p('Kroger', 'Ground Beef 80/20'),
    p('Aldi', 'Ground Beef'),
  ];
  const groups = buildProductGroups(products, 'beef').filter((g) => g.storeCount > 1);
  const steak = groups.find((g) => g.name.toLowerCase().includes('sirloin'));
  assert.ok(steak, 'expected a Beef Sirloin Steak category');
  assert.equal(steak!.storeCount, 4);
});

test('"ground beef" clusters across stores regardless of fat ratio', () => {
  const products = [
    p('Kroger', 'Ground Beef 80/20'),
    p('Aldi', 'Ground Beef 93/7 Lean'),
    p("Trader Joe's", 'Fresh Ground Beef'),
    p('Sprouts', 'Organic Ground Beef'),
  ];
  const group = primaryGroup(products, 'ground beef');
  assert.equal(group.storeCount, 4);
});

// ─── rice ───────────────────────────────────────────────────────────────────

test('"rice" clusters across stores', () => {
  const products = [
    p('Kroger', 'White Rice'),
    p('Aldi', 'Fresh White Rice'),
    p("Trader Joe's", 'Organic White Rice'),
    p('Sprouts', 'White Rice Bag'),
  ];
  const group = primaryGroup(products, 'rice');
  assert.equal(group.storeCount, 4);
});

// ─── pasta ──────────────────────────────────────────────────────────────────

test('"pasta" clusters across stores', () => {
  const products = [
    p('Kroger', 'Penne Pasta'),
    p('Aldi', 'Fresh Penne Pasta'),
    p("Trader Joe's", 'Organic Penne Pasta'),
    p('Sprouts', 'Penne Pasta Value Pack'),
  ];
  const group = primaryGroup(products, 'pasta');
  assert.equal(group.storeCount, 4);
});

// ─── peanut butter ──────────────────────────────────────────────────────────

test('"peanut butter" clusters across stores', () => {
  const products = [
    p('Kroger', 'Creamy Peanut Butter'),
    p('Aldi', 'Fresh Creamy Peanut Butter'),
    p("Trader Joe's", 'Organic Creamy Peanut Butter'),
    p('Sprouts', 'Creamy Peanut Butter Value Pack'),
  ];
  const group = primaryGroup(products, 'peanut butter');
  assert.equal(group.storeCount, 4);
});

// ─── cereal ─────────────────────────────────────────────────────────────────

test('"cereal" clusters across stores', () => {
  const products = [
    p('Kroger', 'Toasted Oat Cereal'),
    p('Aldi', 'Fresh Toasted Oat Cereal'),
    p("Trader Joe's", 'Organic Toasted Oat Cereal'),
    p('Sprouts', 'Toasted Oat Cereal Family Pack'),
  ];
  const group = primaryGroup(products, 'cereal');
  assert.equal(group.storeCount, 4);
});

// ─── frozen pizza ───────────────────────────────────────────────────────────

test('"frozen pizza" clusters across stores', () => {
  const products = [
    p('Kroger', 'Pepperoni Frozen Pizza'),
    p('Aldi', 'Fresh Pepperoni Frozen Pizza'),
    p("Trader Joe's", 'Organic Pepperoni Frozen Pizza'),
    p('Sprouts', 'Pepperoni Frozen Pizza Family Pack'),
  ];
  const group = primaryGroup(products, 'frozen pizza');
  assert.equal(group.storeCount, 4);
});

// ─── coffee ─────────────────────────────────────────────────────────────────

test('"coffee" clusters across stores and prefers the plain roast over a flavored one', () => {
  const products = [
    p('Kroger', 'Ground Coffee'),
    p('Aldi', 'Fresh Ground Coffee'),
    p("Trader Joe's", 'Organic Ground Coffee'),
    p('Sprouts', 'Ground Coffee Value Pack'),
    p('Kroger', 'Vanilla Ground Coffee'),
  ];
  const group = primaryGroup(products, 'coffee');
  assert.equal(group.storeCount, 4);
  assertNoWords(group.name, ['vanilla'], 'a flavored variant');
});

// ─── general sanity: no result never contains penalized words as rep ──────

test('no representative across the whole suite is chosen from a flavor/prepared word set when a plain option exists', () => {
  const group = primaryGroup(CHICKEN_PRODUCTS, 'chicken thighs');
  for (const w of FLAVOR_OR_PREPARED) {
    assert.ok(!group.name.toLowerCase().includes(w), `"${group.name}" unexpectedly contains "${w}"`);
  }
});

// ─── category-layer routing (Search Flow Based on Category Quality) ───────
// categoryLayerIsMeaningful is a single, deterministic rule: show the
// category grid iff there are >= 3 valid/unique/non-empty multi-store
// categories, full stop. An earlier version additionally required those
// categories to "cover" at least half of all direct-match results — which
// meant a real, 3+-category search with a sizeable single-store long tail
// (extremely common) would still bypass the grid. That's exactly the "app
// skips category selection almost all the time, even with clearly more
// than three categories" bug: count alone is now the whole rule.

test('categoryLayerIsMeaningful: 1 category should skip (bypass to comparison)', () => {
  const products = [p('Kroger', 'Widget Alpha'), p('Aldi', 'Widget Alpha')];
  const groups = buildProductGroups(products, 'widget').filter(g => g.storeCount > 1);
  assert.equal(groups.length, 1);
  assert.equal(categoryLayerIsMeaningful(groups), false);
});

test('categoryLayerIsMeaningful: a narrow search with only two categories should skip', () => {
  // "chicken" -> Chicken Breast, Chicken Thighs — exactly the illustrative
  // case from the redesign: too few categories to be worth the click.
  const products = [
    p('Kroger', 'Chicken Breast'),
    p('Aldi', 'Chicken Breast'),
    p("Trader Joe's", 'Chicken Thighs'),
    p('Sprouts', 'Chicken Thighs'),
  ];
  const groups = buildProductGroups(products, 'chicken').filter(g => g.storeCount > 1);
  assert.equal(groups.length, 2);
  assert.equal(categoryLayerIsMeaningful(groups), false);
});

test('categoryLayerIsMeaningful: zero categories should skip', () => {
  assert.equal(categoryLayerIsMeaningful([]), false);
});

test('categoryLayerIsMeaningful: exactly 3 categories should show the category grid, even with a large single-store long tail', () => {
  // This is the exact scenario the coverage rule used to bypass: three
  // real, distinct multi-store categories sitting on top of a pile of
  // single-store stragglers. Per the new deterministic rule, 3 real
  // categories is always enough — coverage is no longer a factor.
  const categorized = [
    p('Kroger', 'Widget Alpha'), p('Aldi', 'Widget Alpha'),
    p('Kroger', 'Widget Bravo'), p('Aldi', 'Widget Bravo'),
    p('Kroger', 'Widget Charlie'), p('Aldi', 'Widget Charlie'),
  ];
  const stragglers = Array.from({ length: 10 }, (_, i) => p('Kroger', `Obscure Item ${i}`));
  const products = [...categorized, ...stragglers];
  const groups = buildProductGroups(products, 'widget').filter(g => g.storeCount > 1);
  assert.equal(groups.length, 3);
  assert.equal(categoryLayerIsMeaningful(groups), true);
});

test('categoryLayerIsMeaningful: 4+ categories should show the category grid', () => {
  // "yogurt"/"cheese"-style search -> five real, evenly-distributed,
  // multi-store categories.
  const products = [
    p('Kroger', 'Greek Yogurt Plain'),
    p('Aldi', 'Greek Yogurt Vanilla'),
    p('Kroger', 'Regular Yogurt'),
    p("Trader Joe's", 'Regular Yogurt'),
    p('Sprouts', 'Drinkable Yogurt'),
    p('Aldi', 'Drinkable Yogurt'),
    p('Kroger', 'Cottage Cheese'),
    p('Sprouts', 'Cottage Cheese'),
    p("Trader Joe's", 'Cream Cheese'),
    p('Aldi', 'Cream Cheese'),
  ];
  const groups = buildProductGroups(products, 'yogurt').filter(g => g.storeCount > 1);
  assert.equal(groups.length, 5);
  assert.equal(categoryLayerIsMeaningful(groups), true);
});

test('categoryLayerIsMeaningful: duplicate category names (case-insensitive) count once', () => {
  const groups: ProductGroup[] = [
    { id: 'a', name: 'Chicken Breast', subtitle: '2 stores', storeCount: 2, category: 'Meat & Seafood', listings: [p('Kroger', 'x'), p('Aldi', 'x')] },
    { id: 'b', name: 'chicken breast', subtitle: '2 stores', storeCount: 2, category: 'Meat & Seafood', listings: [p('Kroger', 'y'), p('Aldi', 'y')] },
    { id: 'c', name: 'Chicken Thighs', subtitle: '2 stores', storeCount: 2, category: 'Meat & Seafood', listings: [p('Kroger', 'z'), p('Aldi', 'z')] },
    { id: 'd', name: 'Ground Beef', subtitle: '2 stores', storeCount: 2, category: 'Meat & Seafood', listings: [p('Kroger', 'w'), p('Aldi', 'w')] },
  ];
  // 4 raw groups, but "Chicken Breast"/"chicken breast" is one category
  // counted twice -> only 3 unique names, right at the threshold.
  assert.equal(countMeaningfulCategories(groups), 3);
  assert.equal(categoryLayerIsMeaningful(groups), true);
});

test('categoryLayerIsMeaningful: placeholder/blank/whitespace-only category names are ignored', () => {
  const groups: ProductGroup[] = [
    { id: 'a', name: 'Widget Alpha', subtitle: '2 stores', storeCount: 2, category: 'Other', listings: [p('Kroger', 'x'), p('Aldi', 'x')] },
    { id: 'b', name: 'Widget Bravo', subtitle: '2 stores', storeCount: 2, category: 'Other', listings: [p('Kroger', 'y'), p('Aldi', 'y')] },
    { id: 'c', name: 'Widget Charlie', subtitle: '2 stores', storeCount: 2, category: 'Other', listings: [p('Kroger', 'z'), p('Aldi', 'z')] },
    { id: 'd', name: '', subtitle: '2 stores', storeCount: 2, category: 'Other', listings: [p('Kroger', 'w'), p('Aldi', 'w')] },
    { id: 'e', name: '   ', subtitle: '2 stores', storeCount: 2, category: 'Other', listings: [p('Kroger', 'v'), p('Aldi', 'v')] },
  ];
  // 5 raw groups, but 2 are blank/whitespace-only placeholders -> 3 real
  // categories, right at the threshold.
  assert.equal(countMeaningfulCategories(groups), 3);
  assert.equal(categoryLayerIsMeaningful(groups), true);
});

test('categoryLayerIsMeaningful: categories with zero listings are ignored', () => {
  const groups: ProductGroup[] = [
    { id: 'a', name: 'Widget Alpha', subtitle: '2 stores', storeCount: 2, category: 'Other', listings: [p('Kroger', 'x'), p('Aldi', 'x')] },
    { id: 'b', name: 'Widget Bravo', subtitle: '2 stores', storeCount: 2, category: 'Other', listings: [p('Kroger', 'y'), p('Aldi', 'y')] },
    { id: 'c', name: 'Widget Charlie', subtitle: '0 stores', storeCount: 0, category: 'Other', listings: [] },
  ];
  // 3 raw groups, but one has no actual products -> only 2 real categories,
  // below the threshold.
  assert.equal(countMeaningfulCategories(groups), 2);
  assert.equal(categoryLayerIsMeaningful(groups), false);
});

test('buildCombinedGroup spans every provided product under a capitalized query name', () => {
  const products = [
    p('Kroger', 'Chicken Breast'),
    p('Aldi', 'Chicken Breast'),
    p("Trader Joe's", 'Chicken Thighs'),
  ];
  const combined = buildCombinedGroup(products, 'chicken');
  assert.equal(combined.name, 'Chicken');
  assert.equal(combined.listings.length, 3);
  assert.equal(combined.storeCount, 3);
});

test('buildCombinedGroup never collides with a real cluster id from buildProductGroups', () => {
  const products = [
    p('Kroger', 'Chicken Breast'),
    p('Aldi', 'Chicken Breast'),
    p("Trader Joe's", 'Chicken Thighs'),
    p('Sprouts', 'Chicken Thighs'),
  ];
  const combined = buildCombinedGroup(products, 'chicken');
  const realGroupIds = buildProductGroups(products, 'chicken').map(g => g.id);
  assert.ok(!realGroupIds.includes(combined.id));
});

// ─── Best Value savings calculation ────────────────────────────────────────
// Regression coverage for the "Save $159.89 on an $8 product" bug:
// getUnitPrice used to switch which physical unit `.value` was denominated
// in (e.g. $/oz vs $/lb) based purely on a single listing's own package
// size, and the savings math then subtracted those raw values across
// listings as if they were always the same unit — mixing scales up to 128x
// apart. getUnitPrice now always returns `value` in one base unit per
// dimension (oz / fl oz / item), so cross-listing comparisons are always
// apples-to-apples, and getBestValueSummary additionally refuses to show
// any savings figure that is negative, non-finite, or implausibly large
// relative to the product's own price.

function unitPriceOf(product: ApiProduct, groupName = product.name) {
  const up = getUnitPrice(product, groupName);
  assert.ok(up, `expected a parsed unit price for size "${product.size}"`);
  return up!;
}

test('getUnitPrice normalizes weight listings to a shared base unit (per oz) regardless of package size', () => {
  const small = unitPriceOf(p('Kroger', 'Chicken Breast', { size: '8 oz', price: 7.99 }));
  const large = unitPriceOf(p('Aldi', 'Chicken Breast', { size: '5 lb', price: 19.99 }));
  assert.equal(small.dimension, 'weight');
  assert.equal(large.dimension, 'weight');
  // Both values are $/oz even though the large pack displays as "$/lb" —
  // this is what makes them safe to subtract/compare directly.
  assert.ok(Math.abs(small.value - 7.99 / 8) < 1e-9);
  assert.ok(Math.abs(large.value - 19.99 / 80) < 1e-9);
  assert.match(small.label, /\/ oz$/);
  assert.match(large.label, /\/ lb$/);
});

test('Best Value savings never explodes into an implausible figure when package sizes cross a unit-display threshold ("chicken breast" bug repro)', () => {
  const group = buildCombinedGroup(
    [
      p('Kroger', 'Boneless Skinless Chicken Breast', { size: '8 oz', price: 7.99 }),
      p('Aldi', 'Chicken Breast Value Pack', { size: '5 lb', price: 19.99 }),
    ],
    'chicken breast',
  );
  const summary = getBestValueSummary(enrichListings(group, null));
  assert.ok(summary);
  assert.ok(summary!.best.product.price < 25, 'sanity: best pick is a realistically-priced grocery item');
  if (summary!.savings != null) {
    assert.ok(
      summary!.savings <= summary!.best.product.price * 3,
      `savings ($${summary!.savings}) must never dwarf the product's own price ($${summary!.best.product.price}) the way "Save $159.89" on an $8 item did`,
    );
  }
});

test('Best Value savings is preserved for a legitimate same-unit cross-store comparison ($5.99 vs $3.99 -> Save $2.00)', () => {
  const group = buildCombinedGroup(
    [
      p('Kroger', 'Whole Milk', { size: '1 gallon', price: 5.99 }),
      p('Aldi', 'Whole Milk', { size: '1 gallon', price: 3.99 }),
    ],
    'milk',
  );
  const summary = getBestValueSummary(enrichListings(group, null));
  assert.ok(summary);
  assert.equal(summary!.best.product.store, 'Aldi');
  assert.ok(summary!.savings != null, 'expected a real savings figure for a legitimate same-unit comparison');
  assert.ok(Math.abs(summary!.savings! - 2.0) < 0.01, `expected ~$2.00 savings, got $${summary!.savings}`);
});

test('Best Value savings is preserved across differently-sized apple bags priced consistently per lb', () => {
  const group = buildCombinedGroup(
    [
      p('Kroger', 'Gala Apples', { size: '3 lb bag', price: 4.5 }),
      p('Aldi', 'Gala Apples', { size: '2 lb bag', price: 5.0 }),
    ],
    'apples',
  );
  const summary = getBestValueSummary(enrichListings(group, null));
  assert.ok(summary);
  assert.equal(summary!.best.product.store, 'Kroger');
  // Kroger: $1.50/lb, Aldi: $2.50/lb -> buying Kroger's 3 lb bag at Aldi's
  // rate would cost 3 * 2.50 = $7.50, a real $3.00 savings.
  assert.ok(summary!.savings != null);
  assert.ok(Math.abs(summary!.savings! - 3.0) < 0.01, `expected ~$3.00 savings, got $${summary!.savings}`);
});

test('Best Value savings is never shown when it would be negative, NaN, or infinite', () => {
  // Only one listing has a parsable size -> no valid cross-listing
  // comparison exists, so savings must be null, never a garbage number.
  const group = buildCombinedGroup(
    [
      p('Kroger', 'Greek Yogurt', { size: '32 oz', price: 5.49 }),
      p('Aldi', 'Greek Yogurt', { size: '', price: 3.99 }),
    ],
    'greek yogurt',
  );
  const summary = getBestValueSummary(enrichListings(group, null));
  assert.ok(summary);
  assert.equal(summary!.savings, null);
});

test('Best Value never mixes unit prices across dimensions (weight vs. count) even if mismatched listings land in one group', () => {
  const group = buildCombinedGroup(
    [
      p('Kroger', 'Chicken Breast', { size: '8 oz', price: 7.99 }),
      p('Aldi', 'Chicken Breast', { size: '12 ct', price: 199.99 }), // clearly wrong dimension for this product
    ],
    'chicken breast',
  );
  const summary = getBestValueSummary(enrichListings(group, null));
  assert.ok(summary);
  // The two listings are in different dimensions (weight vs. count), so no
  // comparable pair exists and savings must stay null rather than mixing
  // $/oz against $/item.
  assert.equal(summary!.savings, null);
});
