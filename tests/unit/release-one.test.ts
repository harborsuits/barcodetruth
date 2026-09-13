import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authStepPath, safeReturnTo } from '../../src/lib/authReturn.ts';
import { createReadOnlyFetch, isPreviewRequestAllowed } from '../../src/lib/previewGuard.ts';
import { normalizeProductBarcode } from '../../src/lib/productBarcode.ts';

test('retail barcode normalization preserves leading zeros and rejects malformed links', () => {
  assert.equal(normalizeProductBarcode('012345678901'), '0012345678901');
  assert.equal(normalizeProductBarcode('0123456789012'), '0123456789012');
  assert.equal(normalizeProductBarcode('01234567'), '01234567');
  for (const value of [undefined, '', '123', 'abc', '../auth', '000000000000000000', '012345678901%']) assert.equal(normalizeProductBarcode(value), null);
});

test('scan destination survives auth and onboarding including query and hash', () => {
  const destination = '/scan-result/0123456789012?label=green%20tea#ownership';
  const login = new URL(authStepPath('auth', destination), 'https://barcodetruth.com');
  const onboarding = new URL(authStepPath('onboarding', login.searchParams.get('returnTo')!), login.origin);
  assert.equal(safeReturnTo(onboarding.searchParams.get('returnTo')), destination);
});

test('return destinations cannot escape the site or cycle through auth', () => {
  for (const target of [undefined, '', 'https://evil.invalid', '//evil.invalid', '/%2fevil.invalid', '/\\evil.invalid', '/%5cevil.invalid', '/%0a/evil.invalid', '/auth', '/AUTH?returnTo=/auth', '/foo/../onboarding', '/%61uth', '/%']) {
    assert.equal(safeReturnTo(target), '/scan', String(target));
  }
  assert.equal(safeReturnTo('/brand/abc?source=search#evidence'), '/brand/abc?source=search#evidence');
});

test('read-only preview blocks writes, auth, functions and unreviewed RPCs before network', async () => {
  let networkCalls = 0;
  const guarded = createReadOnlyFetch('https://test.supabase.co', async () => { networkCalls++; return new Response('ok'); });
  for (const [path, method] of [
    ['/rest/v1/products', 'POST'], ['/rest/v1/products', 'DELETE'], ['/rest/v1/products', 'PATCH'],
    ['/functions/v1/smart-product-lookup', 'POST'], ['/auth/v1/token', 'POST'],
    ['/rest/v1/rpc/log_unknown_barcode', 'GET'], ['/rest/v1/rpc/search_catalog', 'POST'],
  ]) {
    assert.equal((await guarded(`https://test.supabase.co${path}`, { method })).status, 403);
  }
  assert.equal((await guarded(new Request('https://test.supabase.co/rest/v1/products', { method: 'DELETE' }))).status, 403);
  assert.equal(networkCalls, 0);
  assert.equal((await guarded('https://test.supabase.co/rest/v1/products')).status, 200);
  assert.equal((await guarded('https://test.supabase.co/rest/v1/rpc/search_catalog?q=tea')).status, 200);
  assert.equal(networkCalls, 2);
});

test('an isolated loopback backend supports write tests', () => {
  assert.equal(isPreviewRequestAllowed('http://127.0.0.1:54321/auth/v1/token', 'POST'), true);
  assert.equal(isPreviewRequestAllowed('http://localhost:54321/rest/v1/products', 'POST'), true);
});
