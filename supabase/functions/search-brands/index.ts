import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Bucket = { tokens: number; last: number };
const buckets = new Map<string, Bucket>();
const CAP = 8;                 // burst capacity
const REFILL_PER_SEC = 20/60;  // ~20 requests per minute

function rateLimit(ip: string): boolean {
  const now = Date.now() / 1000;
  const b = buckets.get(ip) ?? { tokens: CAP, last: now };
  const refill = (now - b.last) * REFILL_PER_SEC;
  b.tokens = Math.min(CAP, b.tokens + refill);
  b.last = now;
  if (b.tokens < 1) { 
    buckets.set(ip, b); 
    return false; 
  }
  b.tokens -= 1; 
  buckets.set(ip, b); 
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  
  if (!rateLimit(ip)) {
    console.log(JSON.stringify({ 
      level: "warn", 
      fn: "search-brands", 
      ip, 
      msg: "rate_limited" 
    }));
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, 
    Deno.env.get("SUPABASE_ANON_KEY")!
  );

  try {
    const { q } = await req.json();
    const term = (q ?? "").trim();
    
    if (!term) {
      return new Response(JSON.stringify({ data: [] }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const t0 = performance.now();
    
    // Use prefix and contains for fuzzy matching
    const { data, error } = await supabase
      .from("brands")
      .select("id, name, parent_company")
      .or(`name.ilike.${term}%,name.ilike.%${term}%`)
      .limit(25);

    const dur = Math.round(performance.now() - t0);
    
    console.log(JSON.stringify({ 
      level: "info", 
      fn: "search-brands", 
      ip, 
      q: term, 
      count: data?.length ?? 0, 
      dur_ms: dur, 
      ok: !error 
    }));

    if (error) throw error;
    
    return new Response(JSON.stringify({ data }), { 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  } catch (e: any) {
    console.error(JSON.stringify({ 
      level: "error", 
      fn: "search-brands", 
      msg: String(e?.message || e) 
    }));
    
    return new Response(JSON.stringify({ error: "search_failed" }), {
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
