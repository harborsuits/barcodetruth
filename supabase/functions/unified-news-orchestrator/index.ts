// Minimal real ingestion: GDELT -> brand_events + event_sources (dedup by URL hash)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Brand = { id: string; name: string };
type GdeltItem = { 
  url: string; 
  title: string; 
  seendate: string; 
  sourceCountry?: string; 
  domain?: string;
};

function canonicalize(url: string): string {
  try {
    const u = new URL(url);
    u.hash = ""; // strip fragments
    // Strip utm params
    [...u.searchParams.keys()]
      .filter(k => /^utm_|^fbclid$/i.test(k))
      .forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return url;
  }
}

async function sha1(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand_id");
  const max = parseInt(url.searchParams.get("max") || "30");

  try {
    // 1) Pick brand(s)
    let brands: Brand[] = [];
    if (brandId) {
      const { data } = await supabase
        .from("brands")
        .select("id,name")
        .eq("id", brandId)
        .limit(1);
      brands = data ?? [];
    } else {
      // Fallback: take active brands from processing queue
      const { data } = await supabase
        .from("brands")
        .select("id,name")
        .eq("is_active", true)
        .limit(10);
      brands = data ?? [];
    }

    console.log(`[GDELT Orchestrator] Processing ${brands.length} brands`);

    let totalInserted = 0;
    let totalCorroborated = 0;

    for (const b of brands) {
      console.log(`[GDELT] Fetching for: ${b.name}`);
      
      // 2) Fetch GDELT articles for this brand
      const q = encodeURIComponent(`"${b.name}"`);
      const gdeltUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&maxrecords=${max}&format=json&timelang=eng&timespan=7d`;
      
      const gdResp = await fetch(gdeltUrl);
      if (!gdResp.ok) {
        console.error(`[GDELT] API error for ${b.name}: ${gdResp.status}`);
        continue;
      }

      const gd = await gdResp.json();
      const items: GdeltItem[] = gd?.articles ?? [];
      console.log(`[GDELT] Found ${items.length} articles for ${b.name}`);

      for (const item of items) {
        const urlCanon = canonicalize(item.url);
        const urlHash = await sha1(urlCanon);

        // 3) Create event_id first for linking
        const eventId = crypto.randomUUID();

        // 4) Insert source with URL hash deduplication
        const { data: src, error: srcErr } = await supabase
          .from("event_sources")
          .insert({
            event_id: eventId,
            canonical_url: urlCanon,
            canonical_url_hash: urlHash,
            source_name: item.domain ?? new URL(urlCanon).hostname,
            registrable_domain: item.domain ?? new URL(urlCanon).hostname,
            title: item.title?.slice(0, 512) ?? null,
            source_date: item.seendate ? new Date(item.seendate).toISOString() : new Date().toISOString(),
            is_primary: true
          })
          .select("id")
          .single();

        // Skip if duplicate URL
        if (srcErr) {
          if (srcErr.code === '23505') {
            console.log(`[GDELT] Skipping duplicate URL: ${urlCanon}`);
          } else {
            console.error(`[GDELT] Source insert error:`, srcErr);
          }
          continue;
        }

        // 5) Create brand_event (simple classification for MVP)
        const cat = "social"; // TODO: improve via classifier later
        const occurred = item.seendate ? new Date(item.seendate).toISOString() : new Date().toISOString();

        const { error: evErr } = await supabase
          .from("brand_events")
          .insert({
            event_id: eventId,
            brand_id: b.id,
            event_date: occurred,
            occurred_at: occurred,
            category: cat,
            verification: "corroborated",
            title: item.title?.slice(0, 512) ?? `News mention: ${b.name}`,
            is_test: false
          });

        if (!evErr) {
          totalInserted += 1;
          totalCorroborated += 1;
        } else {
          console.error(`[GDELT] Event insert error:`, evErr);
        }
      }
    }

    console.log(`[GDELT Orchestrator] Complete - ${totalInserted} events inserted`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        brands: brands.length, 
        totalInserted, 
        totalCorroborated 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (e: any) {
    console.error("[GDELT Orchestrator] Fatal error:", e);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: String(e?.message || e) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});