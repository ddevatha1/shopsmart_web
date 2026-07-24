// Run with: npm test
//
// Tests the optimizer's pure algorithm (subset enumeration, candidate
// selection/scoring) against fake SubsetPlan fixtures — no network. Mirrors
// warmupService.test.ts's split: the real end-to-end buildShoppingPlan
// (performSearch + planTrip against live stores) isn't covered here for
// the same reason runWarmup isn't there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allNonEmptySubsets, selectCandidates, type SubsetPlan } from './shoppingPlanOptimizer.ts';
import type { PlanStoreAssignment, PlanWeights, StoreName, TripPlan } from '../types/index.ts';

test('allNonEmptySubsets of 4 stores produces exactly 15 non-empty, unique subsets', () => {
  const stores: StoreName[] = ["Trader Joe's", 'Sprouts', 'Kroger', 'Aldi'];
  const subsets = allNonEmptySubsets(stores);
  assert.equal(subsets.length, 15);
  assert.ok(subsets.every(s => s.length > 0));
  const signatures = subsets.map(s => [...s].sort().join(','));
  assert.equal(new Set(signatures).size, 15);
  // Every individual store appears alone exactly once.
  for (const store of stores) {
    assert.equal(subsets.filter(s => s.length === 1 && s[0] === store).length, 1);
  }
  // The full 4-store combination is present exactly once.
  assert.equal(subsets.filter(s => s.length === 4).length, 1);
});

function fakeTripPlan(): TripPlan {
  return {
    origin: { latitude: 0, longitude: 0 },
    totalDurationMinutes: 0,
    totalDistanceMiles: 0,
    routeGeometry: { type: 'LineString', coordinates: [] },
    stops: [],
  };
}

function fakeAssignment(store: StoreName, itemCount: number, subtotal: number): PlanStoreAssignment {
  return {
    store,
    location: { name: store, address: '1 Main St', city: 'Springfield', state: 'TX', zip: '78701', source: 'test-fixture' },
    items: Array.from({ length: itemCount }, (_, i) => ({
      listItemId: `${store}-${i}`,
      rawText: `item ${i}`,
      product: null,
      notFound: false,
    })),
    subtotal,
  };
}

function fakeSubsetPlan(overrides: Partial<SubsetPlan> & { storeAssignments: PlanStoreAssignment[] }): SubsetPlan {
  return {
    totalCost: 0,
    estimatedGasCost: 0,
    totalDriveMinutes: 0,
    totalDriveMiles: 0,
    storeCount: overrides.storeAssignments.length,
    itemsFound: overrides.storeAssignments.reduce((s, a) => s + a.items.length, 0),
    itemsTotal: 3,
    tripPlan: fakeTripPlan(),
    ...overrides,
  };
}

const EQUAL_WEIGHTS: PlanWeights = { cost: 0.25, time: 0.25, distance: 0.25, fewerStops: 0.25 };
const COST_ONLY_WEIGHTS: PlanWeights = { cost: 1, time: 0, distance: 0, fewerStops: 0 };

test('selectCandidates ignores a cheaper plan that covers fewer items than the best coverage available', () => {
  // X: single store, cheap, but only finds 2 of 3 items.
  const x = fakeSubsetPlan({ storeAssignments: [fakeAssignment('Kroger', 2, 10)], totalCost: 10, totalDriveMinutes: 5, totalDriveMiles: 2 });
  // Y: two stores, all 3 items, pricier, but fast.
  const y = fakeSubsetPlan({
    storeAssignments: [fakeAssignment('Kroger', 2, 9), fakeAssignment('Aldi', 1, 6)],
    totalCost: 15, totalDriveMinutes: 20, totalDriveMiles: 10,
  });
  // Z: three stores, all 3 items, cheapest full-coverage option, but slow.
  const z = fakeSubsetPlan({
    storeAssignments: [fakeAssignment('Kroger', 1, 4), fakeAssignment('Aldi', 1, 4), fakeAssignment('Sprouts', 1, 4)],
    totalCost: 12, totalDriveMinutes: 30, totalDriveMiles: 15,
  });

  const [, cheapest, fastest, fewestStops] = selectCandidates([x, y, z], EQUAL_WEIGHTS);

  // Cheapest overall is X (cost 10), but it doesn't achieve max coverage
  // (3 items, achieved by Y and Z) — must never be selected for any tab.
  assert.equal(cheapest.totalCost, 12); // Z, not X
  assert.equal(cheapest.itemsFound, 3);
  assert.equal(fastest.totalDriveMinutes, 20); // Y
  assert.equal(fewestStops.storeCount, 2); // Y (2 stores) beats Z (3 stores)
});

test('selectCandidates: cost-only weights make "balanced" match "cheapest" among max-coverage plans', () => {
  const y = fakeSubsetPlan({
    storeAssignments: [fakeAssignment('Kroger', 2, 9), fakeAssignment('Aldi', 1, 6)],
    totalCost: 15, totalDriveMinutes: 20, totalDriveMiles: 10,
  });
  const z = fakeSubsetPlan({
    storeAssignments: [fakeAssignment('Kroger', 1, 4), fakeAssignment('Aldi', 1, 4), fakeAssignment('Sprouts', 1, 4)],
    totalCost: 12, totalDriveMinutes: 30, totalDriveMiles: 15,
  });

  const [balanced] = selectCandidates([y, z], COST_ONLY_WEIGHTS);
  assert.equal(balanced.totalCost, 12); // Z is cheaper, and cost is the only weighted factor
});

test('estimatedSavings compares against the best-coverage single store, clamped to never go negative', () => {
  // A single store that's cheap but only covers 2/3 items shouldn't be
  // used as the "shopping at one store" baseline if a pricier single
  // store covers all 3 — that's the realistic "what would one stop have
  // actually gotten you" comparison.
  const cheapPartialSingleStore = fakeSubsetPlan({ storeAssignments: [fakeAssignment('Kroger', 2, 10)], totalCost: 10 });
  const fullCoverageSingleStore = fakeSubsetPlan({ storeAssignments: [fakeAssignment('Sprouts', 3, 20)], totalCost: 20 });
  const multiStorePlan = fakeSubsetPlan({
    storeAssignments: [fakeAssignment('Kroger', 1, 4), fakeAssignment('Aldi', 1, 4), fakeAssignment('Sprouts', 1, 4)],
    totalCost: 12,
  });

  const [, cheapest] = selectCandidates([cheapPartialSingleStore, fullCoverageSingleStore, multiStorePlan], EQUAL_WEIGHTS);
  assert.equal(cheapest.totalCost, 12);
  assert.equal(cheapest.estimatedSavings, 8); // 20 (full-coverage single store) - 12
});

test('estimatedSavings is 0, never negative, when the winning plan costs more than the single-store baseline', () => {
  // Single store: cheap, but slow — never wins the "fastest" tab.
  const singleStore = fakeSubsetPlan({
    storeAssignments: [fakeAssignment('Kroger', 3, 10)], totalCost: 10, totalDriveMinutes: 30,
  });
  // Multi-store: pricier, but fast enough to win "fastest" outright —
  // exactly the case where a naive (unclamped) cost - baseline would go
  // negative.
  const fastMultiStore = fakeSubsetPlan({
    storeAssignments: [fakeAssignment('Kroger', 2, 8), fakeAssignment('Aldi', 1, 7)],
    totalCost: 15, totalDriveMinutes: 5,
  });

  const [, , fastest] = selectCandidates([singleStore, fastMultiStore], EQUAL_WEIGHTS);
  assert.equal(fastest.totalDriveMinutes, 5); // confirms fastMultiStore was actually selected
  assert.equal(fastest.totalCost, 15);
  assert.equal(fastest.estimatedSavings, 0); // 10 - 15 would be -5 unclamped
});
