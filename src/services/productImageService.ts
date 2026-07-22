/**
 * On-device cache in front of GET /api/product-image — for when a store
 * didn't provide an image_url, or the one it gave us fails to load. Direct
 * port of shopsmart_mobile's productImageService.ts (localStorage instead
 * of AsyncStorage; a relative same-origin fetch instead of mobile's
 * apiClient, since this app's API route already lives on the same origin).
 */
const CACHE_KEY_PREFIX = 'shopsmart_image_cache_';
const NO_MATCH_SENTINEL = '__no_match__';

function cacheKey(productName: string): string {
  return `${CACHE_KEY_PREFIX}${productName.trim().toLowerCase()}`;
}

/**
 * Resolves a representative photo URL for a product name, checking the
 * on-device cache first. Returns null (and caches that too) when no good
 * match exists — the caller should fall back to the category placeholder
 * icon in that case. Never throws.
 */
export async function resolveProductImage(
  productName: string,
  store?: string,
  storeProductUrl?: string,
): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const key = cacheKey(productName);

  const cached = window.localStorage.getItem(key);
  if (cached === NO_MATCH_SENTINEL) return null;
  if (cached) return cached;

  const params = new URLSearchParams({ name: productName });
  if (store) params.set('store', store);
  if (storeProductUrl) params.set('storeProductUrl', storeProductUrl);

  let imageUrl: string | null = null;
  try {
    const res = await fetch(`/api/product-image?${params.toString()}`);
    if (res.ok) {
      const data = (await res.json()) as { imageUrl: string | null };
      imageUrl = data.imageUrl ?? null;
    }
  } catch {
    // Network failure — treat as "no image," never throw.
  }

  window.localStorage.setItem(key, imageUrl ?? NO_MATCH_SENTINEL);
  return imageUrl;
}
