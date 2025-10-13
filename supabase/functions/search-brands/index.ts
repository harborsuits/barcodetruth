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

// Normalize search term
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // strip punctuation
    .replace(/\s+/g, " ")      // collapse whitespace
    .trim();
}

// Escape SQL LIKE wildcards to prevent unintended pattern matching
function escapeLike(input: string, maxLength = 64): string {
  const trimmed = (input || "").slice(0, maxLength);
  // Escape %, _ and backslash to treat them as literal characters
  return trimmed.replace(/([\\%_])/g, "\\$1");
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
    const rawTerm = (q ?? "").trim();
    
    if (!rawTerm) {
      return new Response(JSON.stringify({ data: [], suggestions: [] }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const t0 = performance.now();
    const normalized = normalize(rawTerm);
    
    // Escape SQL wildcards for safe LIKE queries
    const escapedRaw = escapeLike(rawTerm);
    const escapedNormalized = escapeLike(normalized);
    
    // Step 1: Check aliases (exact + normalized)
    const { data: aliasMatches } = await supabase
      .from("brand_aliases")
      .select(`
        canonical_brand_id,
        external_name,
        brands!brand_aliases_canonical_brand_id_fkey (
          id,
          name,
          parent_company
        )
      `)
      .or(`external_name.ilike.${escapedRaw},external_name.ilike.${escapedNormalized}`)
      .limit(5);

    const aliasResults = (aliasMatches || [])
      .filter(m => m.brands)
      .map(m => ({
        ...m.brands,
        confidence: 0.95,
        match_type: "alias",
        matched_alias: m.external_name
      }));

    // Step 2: Exact/prefix match on brands
    const { data: exactMatches } = await supabase
      .from("brands")
      .select("id, name, parent_company")
      .or(`name.ilike.${escapedRaw},name.ilike.${escapedRaw}%`)
      .limit(10);

    const exactResults = (exactMatches || []).map(b => ({
      ...b,
      confidence: b.name.toLowerCase() === rawTerm.toLowerCase() ? 1.0 : 0.85,
      match_type: "exact"
    }));

    // Step 3: Fuzzy trigram search (if no exact matches)
    let fuzzyResults: any[] = [];
    if (exactResults.length === 0 && aliasResults.length === 0) {
      const { data: fuzzyMatches } = await supabase
        .rpc("search_brands_fuzzy", { 
          search_term: normalized,
          min_similarity: 0.3
        })
        .limit(10);

      fuzzyResults = (fuzzyMatches || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        parent_company: b.parent_company,
        confidence: Math.min(0.8, b.similarity),
        match_type: "fuzzy",
        similarity: b.similarity
      }));
    }

    // Combine and dedupe results
    const allResults = [...aliasResults, ...exactResults, ...fuzzyResults];
    const seen = new Set<string>();
    const uniqueResults = allResults.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });

    // Sort by confidence
    uniqueResults.sort((a, b) => b.confidence - a.confidence);
    const topResults = uniqueResults.slice(0, 10);

    // Generate suggestions (if top result has low confidence)
    const suggestions = topResults.length > 0 && topResults[0].confidence < 0.7
      ? topResults.slice(0, 3).map(r => ({
          id: r.id,
          name: r.name,
          confidence: r.confidence
        }))
      : [];

    const dur = Math.round(performance.now() - t0);
    
    console.log(JSON.stringify({ 
      level: "info", 
      fn: "search-brands", 
      ip, 
      q: rawTerm, 
      normalized,
      alias_hits: aliasResults.length,
      exact_hits: exactResults.length,
      fuzzy_hits: fuzzyResults.length,
      total: topResults.length,
      top_confidence: topResults[0]?.confidence,
      dur_ms: dur
    }));
    
    return new Response(JSON.stringify({ 
      data: topResults,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    }), { 
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
