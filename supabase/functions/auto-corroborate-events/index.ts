import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log("[auto-corroborate] Starting corroboration check...");

    // Normalize title for clustering
    const normTitle = (t: string) => 
      t.toLowerCase().replace(/\s+/g, ' ').trim().substring(0, 100);

    // Find unverified events
    const { data: unverified, error: fetchError } = await supabase
      .from("brand_events")
      .select("event_id, title, event_date, brand_id")
      .eq("verification", "unverified")
      .not("title", "is", null)
      .gte("event_date", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString());

    if (fetchError) throw fetchError;
    if (!unverified || unverified.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No unverified events to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[auto-corroborate] Found ${unverified.length} unverified events`);

    // Group by normalized title and brand
    const clusters = new Map<string, typeof unverified>();
    for (const ev of unverified) {
      const key = `${ev.brand_id}:${normTitle(ev.title || '')}`;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key)!.push(ev);
    }

    const upgraded: string[] = [];

    // For each cluster, check if ≥2 distinct domains
    for (const [key, events] of clusters) {
      if (events.length < 2) continue;

      const eventIds = events.map(e => e.event_id);
      
      // Get distinct domains for these events
      const { data: sources, error: srcError } = await supabase
        .from("event_sources")
        .select("event_id, canonical_url")
        .in("event_id", eventIds);

      if (srcError || !sources) continue;

      const domains = new Set<string>();
      for (const src of sources) {
        try {
          const url = new URL(src.canonical_url || '');
          domains.add(url.hostname.replace(/^www\./, ''));
        } catch {}
      }

      // Upgrade if ≥2 distinct domains
      if (domains.size >= 2) {
        const { error: updateError } = await supabase
          .from("brand_events")
          .update({ verification: "corroborated" })
          .in("event_id", eventIds);

        if (!updateError) {
          upgraded.push(...eventIds);
          console.log(`[auto-corroborate] Upgraded cluster "${key}" with ${domains.size} domains`);
        }
      }
    }

    console.log(`[auto-corroborate] Upgraded ${upgraded.length} events to corroborated`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: unverified.length,
        upgraded: upgraded.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[auto-corroborate] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
