// Environment-based CORS with fallback for development
const getAllowedOrigins = (): string[] => {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) {
    return envOrigins.split(",").map((o) => o.trim()).filter(Boolean);
  }
  // Default allowed origins - production domains
  return [
    "https://barcodetruth.com",
    "https://www.barcodetruth.com",
    "https://app.barcodetruth.com",
  ];
};

const isAllowedOrigin = (origin: string | null): boolean => {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  // Allow localhost in development
  if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
    return Deno.env.get("ENVIRONMENT") !== "production";
  }
  return allowed.includes(origin);
};

// Dynamic CORS helper that validates origin against whitelist
export function buildCorsHeaders(req: Request) {
  const origin = req.headers.get("origin");
  const acrh = req.headers.get("access-control-request-headers");
  
  // Only allow whitelisted origins
  const allowOrigin = isAllowedOrigin(origin) ? origin! : getAllowedOrigins()[0];
  
  return {
    "Access-Control-Allow-Origin": allowOrigin,
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

// Legacy static headers - now uses first allowed origin as default
export const corsHeaders = {
  'Access-Control-Allow-Origin': getAllowedOrigins()[0] || 'https://barcodetruth.com',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};
