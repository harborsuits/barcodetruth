import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lookupApprovedProduct } from '../../src/lib/approvedProductLookup.ts';
import { findIngredientMention, labelIngredients, mentionsShoppingTopic, parseShopNotes, safeEvidenceUrl } from '../../src/lib/shoppingLens.ts';

test('external product identity cannot bypass publication review', async () => {
  const options = { barcodes: ['0044000044268'], readByBarcode: async () => null, lookup: async () => ({ id: 'pending', name: 'Unapproved product', metadata: { ingredients: 'invented' } }), readById: async () => null };
  assert.equal(await lookupApprovedProduct(options), null);
  const approved = { id: 'published', name: 'Published', metadata: { ingredients: 'reviewed record' } };
  assert.equal(await lookupApprovedProduct({ ...options, readById: async () => approved }), approved);
});

test('cached approved products avoid lookup; read failures never masquerade as misses', async () => {
  let lookupCalls = 0;
  const options = { barcodes: ['0044000044268'], readByBarcode: async () => ({ name: 'Pinwheels' }), lookup: async () => { lookupCalls++; return null; }, readById: async () => null };
  assert.deepEqual(await lookupApprovedProduct(options), { name: 'Pinwheels' });
  assert.equal(lookupCalls, 0);
  await assert.rejects(lookupApprovedProduct({ ...options, readByBarcode: async () => { throw new Error('Unavailable'); } }), /Unavailable/);
  assert.equal(lookupCalls, 0);
});

test('ingredient reading preserves unknown and does not interpret absence as suitability', () => {
  for (const metadata of [null, [], { ingredients: [] }, { ingredients: 20 }, {}]) assert.equal(labelIngredients(metadata), null);
  assert.equal(labelIngredients({ ingredients: '  Wheat, Palm Oil, Milk  ' }), 'Wheat, Palm Oil, Milk');
  assert.equal(findIngredientMention('Wheat, Palm Oil, Milk', 'palm oil'), 'mentioned');
  assert.equal(findIngredientMention('Wheat, Palm Oil, Milk', 'peanut'), 'not-found');
  assert.equal(findIngredientMention(null, 'milk'), 'unknown');
  assert.equal(findIngredientMention('Milk', ''), 'unknown');
});

test('corrupt device notes cannot introduce malformed routes or discard valid notes', () => {
  const good = { barcode: '0044000044268', name: 'Pinwheels', reason: 'ingredients', savedAt: '2026-09-13' };
  const invalid = [null, 3, { ...good, barcode: 44000044268 }, { ...good, barcode: ['0044000044268'] }, { ...good, barcode: '123456789' }, { ...good, barcode: { toString: 'bad' } }, { ...good, barcode: '//external' }, { ...good, reason: 'unsupported' }];
  assert.deepEqual(parseShopNotes(JSON.stringify([...invalid, good])), [good]);
  assert.deepEqual(parseShopNotes('{bad'), []);
  assert.deepEqual(parseShopNotes('{}'), []);
});

test('research filtering rejects unrelated merger stories and unsafe source links', () => {
  assert.equal(mentionsShoppingTopic('Kraft Heinz explored food merger', 'politics'), false);
  assert.equal(mentionsShoppingTopic('Arkansas Democrat Gazette: food merger talks', 'politics'), false);
  assert.equal(mentionsShoppingTopic('KraftHeinzPAC political contributions report', 'politics'), true);
  assert.equal(mentionsShoppingTopic('The union criticized factory layoffs', 'labor'), true);
  assert.equal(mentionsShoppingTopic('Family-owned Christian business', 'politics'), false);
  assert.equal(safeEvidenceUrl('javascript:alert(1)'), null);
  assert.equal(safeEvidenceUrl('data:text/html,test'), null);
  assert.equal(safeEvidenceUrl('https://www.fda.gov/'), 'https://www.fda.gov/');
});
