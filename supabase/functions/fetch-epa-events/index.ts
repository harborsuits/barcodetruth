import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const brandId = new URL(req.url).searchParams.get("brand_id");
    const dryrun = new URL(req.url).searchParams.get("dryrun") === "1";
    
    if (dryrun) {
      console.log('[fetch-epa-events] 🧪 DRY RUN enabled - no inserts, no push jobs');
    }
    
    if (!brandId) {
      return new Response(JSON.stringify({ error: "brand_id required" }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[fetch-epa-events] Fetching EPA data for brand: ${brandId}`);

    // Check feature flag
    const { data: config } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "ingest_epa_enabled")
      .maybeSingle();

    if (config?.value === false) {
      console.log("[EPA] Ingestion disabled via feature flag");
      return new Response(
        JSON.stringify({ 
          success: true, 
          scanned: 0, 
          inserted: 0, 
          skipped: 0, 
          note: "EPA ingestion disabled" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // EPA ECHO API - get recent enforcement actions
    // Note: In production, map brand_id -> facility IDs via brand_facilities table
    // Get brand name for matching
    const { data: brand } = await supabase
      .from('brands')
      .select('name')
      .eq('id', brandId)
      .single();

    if (!brand) {
      console.error('[fetch-epa-events] Brand not found');
      return new Response(JSON.stringify({ error: "Brand not found" }), { 
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Search EPA for facilities matching brand name
    const searchUrl = `https://echo.epa.gov/api/echo_rest_services.get_facilities?output=JSON&p_fn=${encodeURIComponent(brand.name)}&p_limit=20`;
    console.log(`[fetch-epa-events] Searching EPA for: ${brand.name}`);

    const res = await fetch(searchUrl);
    if (!res.ok) {
      console.error('[fetch-epa-events] EPA API error:', res.status);
      return new Response(JSON.stringify({ error: "EPA fetch failed" }), { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const json = await res.json();
    const facilities = json?.Results?.Results ?? [];

    console.log(`[fetch-epa-events] Found ${facilities.length} facilities for ${brand.name}`);

    const events = [];
    let scanned = 0;
    let skipped = 0;
    
    for (const facility of facilities.slice(0, 50)) {
      scanned++;
      // Small delay to respect API rate limits
      await new Promise(r => setTimeout(r, 150));
      
      // Check for violations
      if (facility.Viol_Flag === 'Y' || facility.Qtrs_with_NC > 0) {
        const sourceUrl = `https://echo.epa.gov/detailed-facility-report?fid=${facility.RegistryID}`;
        
        // Check if we already have this event (fast dedupe via source_url on brand_events)
        const { data: existing } = await supabase
          .from('brand_events')
          .select('event_id')
          .eq('brand_id', brandId)
          .eq('source_url', sourceUrl)
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[fetch-epa-events] Skipping duplicate: ${sourceUrl}`);
          skipped++;
          continue;
        }

        const qnc = Number(facility.Qtrs_with_NC ?? 0) || 0;
        const impact = qnc > 2 ? -5 : qnc > 0 ? -3 : -1;
        
        const event = {
          brand_id: brandId,
          title: `EPA violation at ${facility.FacName}`,
          description: `Facility ${facility.RegistryID} reported ${facility.Qtrs_with_NC ?? 0} quarters with non-compliance. ${facility.Viol_Flag === 'Y' ? 'Active violations flagged.' : 'Monitoring required.'}`,
          category: 'environment',
          event_date: new Date().toISOString(),
          verification: 'official',
          orientation: 'negative',
          impact_environment: impact,
          source_url: sourceUrl, // For O(1) dedupe
        };

        if (dryrun) {
          console.log(`[fetch-epa-events] [DRYRUN] Would insert event:`, event);
          events.push('dryrun-' + sourceUrl);
          continue;
        }

        // Insert event
        const { data: eventData, error: eventError } = await supabase
          .from('brand_events')
          .insert(event)
          .select('event_id')
          .single();

        if (eventError) {
          // Check if it's a unique violation (race condition)
          if (eventError.code === '23505') {
            console.log(`[fetch-epa-events] Duplicate detected via constraint: ${sourceUrl}`);
            skipped++;
            continue;
          }
          console.error('[fetch-epa-events] Error inserting event:', eventError);
          continue;
        }

        // Canonicalize URL
        const canonicalUrl = (() => {
          try {
            const u = new URL(sourceUrl);
            // Preserve EPA facility ID param
            const params = new URLSearchParams();
            for (const [k, v] of u.searchParams) {
              if (/fid|id|facility|registry/i.test(k)) params.set(k, v);
            }
            return `https://${u.hostname}${u.pathname}${params.toString() ? `?${params}` : ''}`;
          } catch {
            return sourceUrl;
          }
        })();

        const sourceTitle = (facility.FacName || 'Facility').trim();
        const safeTitle = sourceTitle.length >= 4 ? `EPA action at ${sourceTitle}` : 'EPA enforcement record';

        // Insert primary source with full provenance
        const { error: sourceError } = await supabase
          .from('event_sources')
          .upsert(
            {
              event_id: eventData.event_id,
              source_name: 'EPA',
              title: safeTitle,
              canonical_url: canonicalUrl,
              source_url: sourceUrl,
              owner_domain: 'echo.epa.gov',
              source_date: new Date().toISOString(),
              is_primary: true,
              link_kind: 'database',
              article_snippet: `Facility: ${facility.FacName}, Registry ID: ${facility.RegistryID}`,
            },
            { onConflict: 'event_id,canonical_url', ignoreDuplicates: true }
          );

        if (sourceError) {
          console.error('[fetch-epa-events] Error inserting source:', sourceError);
        }

        console.log(`[fetch-epa-events] ✅ evidence_source_primary_inserted: event=${eventData.event_id}, source=EPA, domain=echo.epa.gov`);

        events.push(eventData.event_id);
      }
    }

    console.log(`[fetch-epa-events] Scanned: ${scanned}, Inserted: ${events.length}, Skipped: ${skipped}`);

    // If we created any events, enqueue a coalesced push for this brand
    if (events.length > 0 && !dryrun) {
      // Fetch brand name for nicer notification text
      const { data: brandRow } = await supabase
        .from('brands')
        .select('id, name')
        .eq('id', brandId)
        .maybeSingle();

      // 5-minute coalescing bucket key (same pattern as score-change producer)
      const bucketSec = Math.floor(Date.now() / (5 * 60 * 1000)) * 5 * 60;
      const coalesceKey = `${brandId}:${bucketSec}`;

      // Build a concise events summary for payload (environment-only here)
      const nowISO = new Date().toISOString();
      const payload = {
        brand_id: brandId,
        brand_name: brandRow?.name ?? brandId,
        at: nowISO,
        events: [
          {
            category: 'environment',
            // Treat EPA inserts as a negative movement "signal"; consumer will coalesce.
            delta: -1 * events.length, // keeps "one clean alert" behavior while conveying magnitude
          },
        ],
      };

      // Atomically merge into any existing bucketed job
      const { error: upsertErr } = await supabase.rpc('upsert_coalesced_job', {
        p_stage: 'send_push_for_score_change',
        p_key: coalesceKey,
        p_payload: payload,
        p_not_before: nowISO,
      });

      if (upsertErr) {
        console.error('[fetch-epa-events] Failed to enqueue coalesced job:', upsertErr);
      } else {
        console.log(
          `[fetch-epa-events] Enqueued coalesced job for ${brandRow?.name ?? brandId} (inserted=${events.length})`
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        dryrun,
        scanned,
        inserted: events.length,
        skipped,
        event_ids: events 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('[fetch-epa-events] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
