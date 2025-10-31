// Dynamic CORS helper that echoes back origin & requested headers
export function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  const acrh = req.headers.get("access-control-request-headers");
  return {
    "Access-Control-Allow-Origin": origin,
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers":
      acrh ??
      "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-requested-with",
    "Access-Control-Max-Age": "86400",
  };
}

export function okJson(body: any, req: Request) {
  const headers = buildCorsHeaders(req);
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export function errJson(status: number, message: string, req: Request) {
  const headers = buildCorsHeaders(req);
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

// Legacy exports for backwards compatibility
export function corsHeadersFor(req: Request) {
  return buildCorsHeaders(req);
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
