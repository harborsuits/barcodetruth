/** A local preview must not write to the deployed application's backend. */
export function isPreviewRequestAllowed(url: string, method = 'GET'): boolean {
  const parsed = new URL(url);
  if (['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) return true;
  return ['GET', 'HEAD'].includes(method.toUpperCase()) &&
    parsed.pathname.startsWith('/rest/v1/') &&
    (!parsed.pathname.startsWith('/rest/v1/rpc/') ||
      ['/rest/v1/rpc/search_catalog', '/rest/v1/rpc/get_smart_alternatives', '/rest/v1/rpc/get_brand_ownership'].includes(parsed.pathname));
}

export function createReadOnlyFetch(backendUrl: string, originalFetch: typeof fetch): typeof fetch {
  const backendOrigin = new URL(backendUrl).origin;
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const target = new URL(url, backendOrigin);
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (target.origin === backendOrigin && !isPreviewRequestAllowed(target.href, method)) {
      return new Response(JSON.stringify({ message: 'This local preview is read-only. Use an isolated backend to test account changes and lookups.' }), {
        status: 403, headers: { 'Content-Type': 'application/json' },
      });
    }
    return originalFetch(input, init);
  };
}
