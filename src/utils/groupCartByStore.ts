import type { CartItem, StoreGroup, StoreLocation } from '@/types';

/** Same dedup key shape as the backend's tripPlanner.ts — one group per
 * physical store, not per product/brand. Direct port of
 * shopsmart_mobile's groupCartByStore.ts. */
export function locationKey(loc: StoreLocation): string {
  return `${loc.storeId ?? ''}|${loc.address}|${loc.city}|${loc.state}|${loc.zip}`.toLowerCase();
}

/**
 * The "store selection" step of the route pipeline: groups a shopper's
 * cart by the exact StoreLocation each product came from — never by store
 * chain name alone, so two different physical Krogers never collapse into
 * one stop.
 *
 * Items whose product has no location data at all can't be routed to —
 * they're returned separately rather than silently dropped.
 */
export function groupCartByStore(items: CartItem[]): {
  groups: StoreGroup[];
  itemsWithoutLocation: CartItem[];
} {
  const groups = new Map<string, StoreGroup>();
  const itemsWithoutLocation: CartItem[] = [];

  for (const item of items) {
    const location = item.product.location;
    if (!location) {
      itemsWithoutLocation.push(item);
      continue;
    }
    const key = locationKey(location);
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(key, { location, items: [item] });
    }
  }

  return { groups: Array.from(groups.values()), itemsWithoutLocation };
}
