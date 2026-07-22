import { create } from 'zustand';
import type { StoreName } from '../types';

/** Direct port of shopsmart_mobile/src/store/storeModeStore.ts. */
interface StoreModeState {
  /** null = default comparison-first mode. Set only when a shopper
   * explicitly opts into "Search Within One Store." In-memory only (no
   * persistence): "remember the user's choice during the current search
   * session" means this browser session, not forever — a fresh page load
   * always starts in comparison mode. */
  selectedStore: StoreName | null;
  setSelectedStore: (store: StoreName | null) => void;
}

export const useStoreModeStore = create<StoreModeState>((set) => ({
  selectedStore: null,
  setSelectedStore: (store) => set({ selectedStore: store }),
}));
