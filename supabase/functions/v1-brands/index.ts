import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/,'');
  
  // Extract path after /functions/v1/v1-brands/
  // e.g., /functions/v1/v1-brands/search -> /search
  const functionBase = '/functions/v1/v1-brands';
  const routePath = path.startsWith(functionBase) 
    ? path.substring(functionBase.length) 
    : path;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { fetch } }
  );

  try {
    // /search
    if (routePath === "/search" && req.method === "GET") {
      const q = url.searchParams.get("q")?.trim() ?? "";
      if (!q) return json({ products: [], brands: [] });
      
      const { data, error } = await supabase.rpc("search_entities", { 
        p_q: q, 
        p_limit: 20 
      });
      
      if (error) throw error;
      return json(data ?? { products: [], brands: [] });
    }

    // /trending
    if (routePath === "/trending" && req.method === "GET") {
      const limit = Number(url.searchParams.get("limit") ?? 25);
      
      const { data, error } = await supabase
        .from("brand_trending")
        .select("*")
        .order("trend_score", { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 50));
      
      if (error) throw error;
      return json(data);
    }

    // /brands/:id
    if (routePath.startsWith("/brands/") && req.method === "GET") {
      const brandId = routePath.substring("/brands/".length);
      
      // Get standings (score, freshness, summary)
      const { data: standing, error: e1 } = await supabase
        .from("brand_standings")
        .select("*")
        .eq("brand_id", brandId)
        .maybeSingle();
      
      if (e1) throw e1;
      if (!standing) return notFound("Brand not found");

      // Get evidence links (clickable)
      const { data: evidence, error: e2 } = await supabase
        .from("brand_latest_evidence")
        .select("title, url, source_name")
        .eq("brand_id", brandId);
      
      if (e2) throw e2;

      return json({ ...standing, evidence: evidence || [] });
    }

    return notFound("Route not found");
  } catch (e) {
    console.error("API Error:", e);
    const errorMessage = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({ error: errorMessage }), 
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function notFound(msg = "Not found") { 
  return json({ error: msg }, 404); 
}
