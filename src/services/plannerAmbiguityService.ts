/**
 * Smart Shopping Planner — list intake + ambiguity resolution.
 *
 * Entirely synchronous, dependency-free (no network, no server round trip):
 * `findTaxonomyEntry`/`classifyProductSubtype`'s taxonomy data already
 * covers exactly the kind of ambiguity a grocery list creates ("milk" ->
 * which kind?), and correctQuery is likewise pure/sync — so the whole
 * "read the list, decide what needs asking about" step can run instantly
 * on the client the moment the shopper submits their list, no spinner
 * needed before the clarification step (or before skipping straight to
 * planning, when nothing is ambiguous).
 */
import { correctQuery } from '@/services/queryCorrection';
import { findTaxonomyEntry } from '@/data/groceryTaxonomy';
import type { AmbiguityPrompt, PlannerListItem } from '@/types';

/** Splits a free-text list into individual items — one per line, or comma
 * separated within a line (so "milk, eggs, bread" on one line works the
 * same as three separate lines). Trims, dedupes (case-insensitive), drops
 * empties. */
export function parseListInput(raw: string): string[] {
  const items = raw
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

export interface AnalyzeItemsResult {
  resolved: PlannerListItem[];
  prompts: AmbiguityPrompt[];
}

/**
 * For each raw list item: typo-correct it, then check whether it maps to a
 * taxonomy entry with more than one subtype. If it doesn't (no entry, or
 * only one subtype — e.g. bananas), or a remembered preference already
 * covers it, it's resolved immediately with no prompt. Otherwise it
 * becomes one `AmbiguityPrompt`, grouped by taxonomy entry so "milk" and
 * "2% milk please" (if a shopper typed both) collapse into a single
 * question rather than two.
 */
export function analyzeItems(
  rawItems: string[],
  rememberedPrefs: Record<string, string>,
): AnalyzeItemsResult {
  const resolved: PlannerListItem[] = [];
  const promptsByEntry = new Map<string, AmbiguityPrompt>();

  rawItems.forEach((rawText, index) => {
    const id = `item-${index}-${rawText.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const corrected = correctQuery(rawText);
    const query = corrected.level === 'none' ? corrected.normalized : corrected.corrected;

    const entry = findTaxonomyEntry(query);
    if (!entry || entry.subtypes.length <= 1) {
      resolved.push({ id, rawText });
      return;
    }

    const remembered = rememberedPrefs[entry.id];
    if (remembered !== undefined) {
      resolved.push({
        id,
        rawText,
        taxonomyEntryId: entry.id,
        subtypeId: remembered === 'no-preference' ? null : remembered,
      });
      return;
    }

    // groceryTaxonomy.ts only sets `defaultSubtypeId` where a genuine
    // majority-default exists (e.g. unlabeled eggs are almost always
    // Large; bananas are conventional unless the listing says otherwise) —
    // exactly the "don't ask, a safe default exists" signal per the
    // planner's own requirement to skip clarifying bananas/eggs/etc. An
    // entry with no default (milk, chicken, bread — genuinely no dominant
    // variety) is the one that actually needs a prompt.
    if (entry.defaultSubtypeId) {
      resolved.push({ id, rawText, taxonomyEntryId: entry.id, subtypeId: entry.defaultSubtypeId });
      return;
    }

    resolved.push({ id, rawText, taxonomyEntryId: entry.id });

    const existing = promptsByEntry.get(entry.id);
    if (existing) {
      existing.listItemIds.push(id);
      return;
    }
    promptsByEntry.set(entry.id, {
      taxonomyEntryId: entry.id,
      itemLabel: entry.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      listItemIds: [id],
      options: entry.subtypes.map(s => ({ subtypeId: s.id, label: s.label })),
      rememberedDefault: entry.defaultSubtypeId,
    });
  });

  return { resolved, prompts: Array.from(promptsByEntry.values()) };
}

/**
 * Applies the shopper's clarify-step answers back onto the resolved list —
 * `answers` maps taxonomyEntryId -> chosen subtypeId, or `null` for
 * "No Preference". Every list item that shared that taxonomy entry gets
 * the same answer.
 */
export function applyAmbiguityAnswers(
  items: PlannerListItem[],
  answers: Record<string, string | null>,
): PlannerListItem[] {
  return items.map(item => {
    if (!item.taxonomyEntryId || !(item.taxonomyEntryId in answers)) return item;
    return { ...item, subtypeId: answers[item.taxonomyEntryId] };
  });
}
