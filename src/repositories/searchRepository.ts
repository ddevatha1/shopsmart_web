import type { SearchResponse } from '../types';

/**
 * Deliberately thin — all search business logic (relevance ranking, food
 * filtering, per-store price handling, store fan-out) lives server-side in
 * this app's own `/api/search` route. Unlike shopsmart_mobile (which calls
 * a separate standalone Express server via an absolute base URL), this
 * hits the Next.js API route on the same origin with a plain relative path.
 */
export class ApiError extends Error {}

export const searchRepository = {
  async search(query: string, zipcode: string, options?: { noCorrect?: boolean }): Promise<SearchResponse> {
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, zipcode, noCorrect: options?.noCorrect }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new ApiError(json?.error ?? `Search failed (${res.status}).`);
    }
    return json as SearchResponse;
  },
};
