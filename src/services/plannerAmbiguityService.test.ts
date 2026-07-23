// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseListInput, analyzeItems, applyAmbiguityAnswers } from './plannerAmbiguityService.ts';

test('parseListInput splits on newlines and commas, trims, dedupes, drops empties', () => {
  const items = parseListInput('milk, eggs\n\nbread\nMilk\n  bananas  ');
  assert.deepEqual(items, ['milk', 'eggs', 'bread', 'bananas']);
});

test('an item with no taxonomy entry at all needs no clarification', () => {
  const { resolved, prompts } = analyzeItems(['paper towels'], {});
  assert.equal(prompts.length, 0);
  assert.equal(resolved[0].taxonomyEntryId, undefined);
  assert.equal(resolved[0].subtypeId, undefined);
});

test('an item whose taxonomy entry has a safe default (bananas) auto-resolves without a prompt', () => {
  const { resolved, prompts } = analyzeItems(['bananas'], {});
  assert.equal(prompts.length, 0);
  assert.equal(resolved[0].taxonomyEntryId, 'bananas');
  assert.equal(resolved[0].subtypeId, 'conventional');
});

test('a genuinely ambiguous item (milk) produces exactly one prompt with every subtype option', () => {
  const { resolved, prompts } = analyzeItems(['milk'], {});
  assert.equal(prompts.length, 1);
  assert.equal(prompts[0].taxonomyEntryId, 'milk');
  assert.ok(prompts[0].options.some(o => o.subtypeId === 'two-percent'));
  assert.ok(prompts[0].options.some(o => o.subtypeId === 'whole'));
  assert.equal(resolved[0].taxonomyEntryId, 'milk');
  assert.equal(resolved[0].subtypeId, undefined); // not yet answered
});

test('two list items mapping to the same taxonomy entry collapse into one prompt', () => {
  const { prompts } = analyzeItems(['milk', 'chocolate milk'], {});
  const milkPrompts = prompts.filter(p => p.taxonomyEntryId === 'milk');
  assert.equal(milkPrompts.length, 1);
  assert.equal(milkPrompts[0].listItemIds.length, 2);
});

test('a remembered preference resolves the item immediately with no prompt', () => {
  const { resolved, prompts } = analyzeItems(['milk'], { milk: 'two-percent' });
  assert.equal(prompts.length, 0);
  assert.equal(resolved[0].subtypeId, 'two-percent');
});

test('a remembered "no-preference" also resolves immediately, as null', () => {
  const { resolved, prompts } = analyzeItems(['chicken'], { chicken: 'no-preference' });
  assert.equal(prompts.length, 0);
  assert.equal(resolved[0].subtypeId, null);
});

test('a mixed list only prompts for the genuinely ambiguous items', () => {
  const { prompts } = analyzeItems(['milk', 'eggs', 'bananas', 'bread'], {});
  const entryIds = prompts.map(p => p.taxonomyEntryId).sort();
  assert.deepEqual(entryIds, ['bread', 'milk']);
});

test('applyAmbiguityAnswers writes the chosen subtype (or null) onto every matching item, leaving others untouched', () => {
  const { resolved } = analyzeItems(['milk', 'chocolate milk', 'paper towels'], {});
  const updated = applyAmbiguityAnswers(resolved, { milk: 'whole' });
  const milkItems = updated.filter(i => i.taxonomyEntryId === 'milk');
  assert.equal(milkItems.length, 2);
  assert.ok(milkItems.every(i => i.subtypeId === 'whole'));
  const unrelatedItem = updated.find(i => i.rawText === 'paper towels');
  assert.equal(unrelatedItem?.subtypeId, undefined);
});

test('applyAmbiguityAnswers with a null answer records "No Preference"', () => {
  const { resolved } = analyzeItems(['milk'], {});
  const updated = applyAmbiguityAnswers(resolved, { milk: null });
  assert.equal(updated[0].subtypeId, null);
});
