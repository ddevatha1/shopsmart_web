/** Remembered grocery-list subtype preferences — "this shopper always means
 * 2% milk" — scoped per signed-in account, same localStorage pattern as
 * cartRepository/purchaseHistoryService. Maps taxonomyEntryId (e.g. "milk")
 * to either a chosen subtypeId (e.g. "two-percent") or the literal string
 * 'no-preference', which is itself a remembered, sticky choice — a shopper
 * who explicitly says "let the optimizer decide" shouldn't be re-asked
 * next time either. */
const keyFor = (ownerEmail: string) => `shopsmart_planner_prefs_${ownerEmail}`;

export type PlannerPreferences = Record<string, string>;

export const plannerPreferenceRepository = {
  async load(ownerEmail: string): Promise<PlannerPreferences> {
    if (typeof window === 'undefined' || !ownerEmail) return {};
    const raw = window.localStorage.getItem(keyFor(ownerEmail));
    if (!raw) return {};
    try {
      return JSON.parse(raw) as PlannerPreferences;
    } catch {
      return {};
    }
  },

  async save(ownerEmail: string, prefs: PlannerPreferences): Promise<void> {
    if (typeof window === 'undefined' || !ownerEmail) return;
    window.localStorage.setItem(keyFor(ownerEmail), JSON.stringify(prefs));
  },
};
