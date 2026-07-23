// Run with: npm test
//
// onboardingRepository reads/writes `window.localStorage`, which doesn't
// exist in this plain-Node test runner (no jsdom) — a minimal in-memory
// polyfill is installed before importing the store so the real
// load()/save() branches actually execute, rather than silently
// short-circuiting on the `typeof window === 'undefined'` guard.
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useOnboardingStore } from './onboardingStore.ts';

function resetInMemoryState() {
  useOnboardingStore.setState({ completed: false, hintsSeen: {}, hydrated: false });
}

test('hydrate() defaults to not-completed with no hints seen when nothing is persisted', async () => {
  fakeLocalStorage.clear();
  resetInMemoryState();

  await useOnboardingStore.getState().hydrate();
  const state = useOnboardingStore.getState();
  assert.equal(state.hydrated, true);
  assert.equal(state.completed, false);
  assert.deepEqual(state.hintsSeen, {});
});

test('completeOnboarding() persists across a fresh hydrate (simulating a page reload)', async () => {
  fakeLocalStorage.clear();
  resetInMemoryState();

  await useOnboardingStore.getState().hydrate();
  await useOnboardingStore.getState().completeOnboarding();
  assert.equal(useOnboardingStore.getState().completed, true);

  resetInMemoryState();
  await useOnboardingStore.getState().hydrate();
  assert.equal(useOnboardingStore.getState().completed, true);
});

test('markHintSeen()/isHintSeen() round-trip and persist independently per hint key', async () => {
  fakeLocalStorage.clear();
  resetInMemoryState();

  await useOnboardingStore.getState().hydrate();
  assert.equal(useOnboardingStore.getState().isHintSeen('cart'), false);

  await useOnboardingStore.getState().markHintSeen('cart');
  assert.equal(useOnboardingStore.getState().isHintSeen('cart'), true);
  assert.equal(useOnboardingStore.getState().isHintSeen('route'), false);

  resetInMemoryState();
  await useOnboardingStore.getState().hydrate();
  assert.equal(useOnboardingStore.getState().isHintSeen('cart'), true);
  assert.equal(useOnboardingStore.getState().isHintSeen('route'), false);
});

test('resetOnboarding() clears both the completed flag and every seen hint ("Restart Onboarding")', async () => {
  fakeLocalStorage.clear();
  resetInMemoryState();

  await useOnboardingStore.getState().hydrate();
  await useOnboardingStore.getState().completeOnboarding();
  await useOnboardingStore.getState().markHintSeen('search-compare');
  await useOnboardingStore.getState().markHintSeen('cart');

  await useOnboardingStore.getState().resetOnboarding();
  assert.equal(useOnboardingStore.getState().completed, false);
  assert.deepEqual(useOnboardingStore.getState().hintsSeen, {});

  resetInMemoryState();
  await useOnboardingStore.getState().hydrate();
  assert.equal(useOnboardingStore.getState().completed, false);
  assert.deepEqual(useOnboardingStore.getState().hintsSeen, {});
});

test('a malformed/corrupt persisted value falls back to defaults instead of throwing', async () => {
  fakeLocalStorage.clear();
  resetInMemoryState();
  fakeLocalStorage.setItem('shopsmart_onboarding_v1', 'not valid json{{{');

  await useOnboardingStore.getState().hydrate();
  const state = useOnboardingStore.getState();
  assert.equal(state.completed, false);
  assert.deepEqual(state.hintsSeen, {});
});
