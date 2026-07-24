// Run with: npm test
//
// cartRepository reads/writes `window.localStorage`, which doesn't exist in
// this plain-Node test runner (no jsdom) — a minimal in-memory polyfill is
// installed before importing the store so the real loadCart()/saveCart()
// branches actually execute, rather than silently short-circuiting on the
// `typeof window === 'undefined'` guard. Same pattern as
// store/onboardingStore.test.ts.
class FakeLocalStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const fakeLocalStorage = new FakeLocalStorage();
(globalThis as unknown as { window: { localStorage: FakeLocalStorage } }).window = { localStorage: fakeLocalStorage };

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useCartStore } from './cartStore.ts';
import { useUserStore } from './userStore.ts';
import type { ApiProduct, CartItem, User } from '../types/index.ts';

const TEST_USER: User = { id: '1', name: 'Test', email: 'shopper@example.com', zipcode: '75034', searchHistory: [] };

function makeProduct(id: string, store: ApiProduct['store'] = 'Kroger', price = 3): ApiProduct {
  return { id, name: `Product ${id}`, brand: 'Brand', price, rating: 4, size: '1 ea', store };
}

function makeItem(id: string, store: ApiProduct['store'] = 'Kroger', price = 3): CartItem {
  return { product: makeProduct(id, store, price), quantity: 1 };
}

describe('cartStore — Auto-Optimize apply/undo', () => {
  beforeEach(() => {
    fakeLocalStorage.clear();
    useUserStore.setState({ user: TEST_USER });
    useCartStore.setState({ items: [], hydrated: true, lastOptimizationSnapshot: null });
  });

  test('applyOptimizedItems replaces the cart and snapshots the previous items', async () => {
    const before = [makeItem('a', 'Kroger'), makeItem('b', 'Aldi')];
    useCartStore.setState({ items: before });

    const after = [makeItem('a', 'Sprouts', 2.5)];
    await useCartStore.getState().applyOptimizedItems(after);

    assert.deepEqual(useCartStore.getState().items, after);
    assert.deepEqual(useCartStore.getState().lastOptimizationSnapshot, before);
  });

  test('undoLastOptimization restores the exact pre-apply cart instantly', async () => {
    const before = [makeItem('a', 'Kroger'), makeItem('b', 'Aldi')];
    useCartStore.setState({ items: before });
    await useCartStore.getState().applyOptimizedItems([makeItem('a', 'Sprouts')]);

    await useCartStore.getState().undoLastOptimization();

    assert.deepEqual(useCartStore.getState().items, before);
    // Undo is single-shot — no snapshot left to undo again.
    assert.equal(useCartStore.getState().lastOptimizationSnapshot, null);
  });

  test('undoLastOptimization persists the restored cart (survives a fresh hydrate)', async () => {
    const before = [makeItem('a', 'Kroger')];
    useCartStore.setState({ items: before });
    await useCartStore.getState().applyOptimizedItems([makeItem('a', 'Sprouts')]);
    await useCartStore.getState().undoLastOptimization();

    useCartStore.setState({ items: [], hydrated: false, lastOptimizationSnapshot: null });
    await useCartStore.getState().hydrate();

    assert.deepEqual(useCartStore.getState().items, before);
  });

  test('undoLastOptimization is a no-op when nothing is pending', async () => {
    const items = [makeItem('a', 'Kroger')];
    useCartStore.setState({ items, lastOptimizationSnapshot: null });

    await useCartStore.getState().undoLastOptimization();

    assert.deepEqual(useCartStore.getState().items, items);
  });

  test('a manual cart edit after applying clears the pending undo snapshot', async () => {
    useCartStore.setState({ items: [makeItem('a', 'Kroger')] });
    await useCartStore.getState().applyOptimizedItems([makeItem('b', 'Sprouts')]);
    assert.notEqual(useCartStore.getState().lastOptimizationSnapshot, null);

    await useCartStore.getState().addToCart(makeProduct('c', 'Aldi'));

    assert.equal(useCartStore.getState().lastOptimizationSnapshot, null);
  });

  test('setCart (e.g. the Planner\'s "Start Shopping") also clears any pending optimize-undo', async () => {
    useCartStore.setState({ items: [makeItem('a', 'Kroger')] });
    await useCartStore.getState().applyOptimizedItems([makeItem('b', 'Sprouts')]);
    assert.notEqual(useCartStore.getState().lastOptimizationSnapshot, null);

    await useCartStore.getState().setCart([makeItem('c', 'Aldi')]);

    assert.equal(useCartStore.getState().lastOptimizationSnapshot, null);
  });
});
