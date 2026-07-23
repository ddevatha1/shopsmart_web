import type { PlannerListItem, ShoppingPlanResponse } from '@/types';

export class PlannerApiError extends Error {}

/** Posts already-resolved list items to /api/planner — same same-origin
 * API-route pattern as tripService.planShoppingTrip. */
export async function generateShoppingPlan(
  items: PlannerListItem[],
  zipcode: string,
): Promise<ShoppingPlanResponse> {
  const res = await fetch('/api/planner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, zipcode }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new PlannerApiError(body?.error ?? `Server returned ${res.status}`);
  }
  return body as ShoppingPlanResponse;
}
