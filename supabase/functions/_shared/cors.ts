// Dynamic CORS helper that echoes back any headers the browser requests
export function corsHeadersFor(req: Request) {
  // Whatever the browser asks for in the preflight:
  const acrh = req.headers.get('access-control-request-headers') ?? '';
  // Safe defaults we always allow (covers Supabase SDK + JSON posts)
  const defaults = [
    'authorization',
    'apikey',
    'content-type',
    'x-client-info',
    'x-supabase-api-version'
  ];
  // Merge + dedupe
  const allowHeaders = Array.from(
    new Set(
      [...defaults, ...acrh.split(',').map(h => h.trim()).filter(Boolean)]
    )
  ).join(', ');

  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': allowHeaders,
  };
}

// Legacy static export for backwards compatibility
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
