import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithBackoff } from "./lib/http.ts";
import { 
  buildPrimaryUrl, 
  buildFallbackUrl, 
  parseEchoResponse,
  parseEnvirofactsResponse,
  toInternalEvent,
  EPAFacility
} from "./lib/epa.ts";
import { normalizeCompanyName, generateVariants } from "./lib/normalize.ts";
import { upsertEvents, logDefer, enqueueNotification } from "./store/upsert.ts";

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
      console.log("[fetch-epa-events] Ingestion disabled via feature flag");
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

    // Normalize and generate variants for better matching
    const normalized = normalizeCompanyName(brand.name);
    const variants = generateVariants(brand.name);
    const searchName = variants[0]; // Use best variant for search
    
    console.log(`[fetch-epa-events] Searching EPA for: ${searchName} (variants: ${variants.length})`);

    const init = {
      headers: {
        "user-agent": "BarcodeTruthBot/1.0 (+support@barcode-truth.app)",
        "accept": "application/json"
      }
    };

    let facilities: EPAFacility[] = [];
    let source = 'primary';

    // Try primary endpoint (ECHO API) with retry
    try {
      const primaryUrl = buildPrimaryUrl(searchName);
      console.log(`[fetch-epa-events] Trying primary: ${primaryUrl}`);
      
      const res = await fetchWithBackoff(primaryUrl, init);
      
      if (!res.ok) {
        throw new Error(`primary_${res.status}`);
      }
      
      const data = await res.json();
      facilities = parseEchoResponse(data);
      
      console.log(`[fetch-epa-events] Primary endpoint returned ${facilities.length} facilities`);
    } catch (primaryError) {
      console.warn(`[fetch-epa-events] Primary endpoint failed:`, primaryError);
      
      // Try fallback endpoint (Envirofacts)
      try {
        const fallbackUrl = buildFallbackUrl(searchName);
        console.log(`[fetch-epa-events] Trying fallback: ${fallbackUrl}`);
        
        const res2 = await fetchWithBackoff(fallbackUrl, init);
        
        if (!res2.ok) {
          throw new Error(`fallback_${res2.status}`);
        }
        
        const data2 = await res2.json();
        facilities = parseEnvirofactsResponse(data2);
        source = 'fallback';
        
        console.log(`[fetch-epa-events] Fallback endpoint returned ${facilities.length} facilities`);
      } catch (fallbackError) {
        console.error(`[fetch-epa-events] Both endpoints failed:`, {
          primary: String(primaryError),
          fallback: String(fallbackError)
        });
        
        // Log deferred state for retry
        await logDefer(supabase, {
          brand_id: brandId,
          query: searchName,
          reason: 'upstream_5xx',
          detail: `Primary: ${String(primaryError)}, Fallback: ${String(fallbackError)}`
        });
        
        return new Response(
          JSON.stringify({ 
            deferred: true, 
            reason: 'EPA API unavailable',
            tried: ['ECHO', 'Envirofacts']
          }), 
          { 
            status: 202,
            headers: { ...corsHeaders, "Content-Type": "application/json" }
          }
        );
      }
    }

    // Filter facilities with violations
    const violationFacilities = facilities
      .filter(f => f.Viol_Flag === 'Y' || f.Qtrs_with_NC > 0)
      .slice(0, 50); // Limit to 50

    console.log(`[fetch-epa-events] Found ${violationFacilities.length} facilities with violations`);

    // Convert to internal events
    const eventsToUpsert = violationFacilities.map(facility => ({
      event: toInternalEvent(facility, brandId),
      facility
    }));

    // Upsert events with idempotent deduplication
    const { inserted, skipped } = await upsertEvents(supabase, eventsToUpsert, dryrun);

    console.log(`[fetch-epa-events] Scanned: ${facilities.length}, Inserted: ${inserted.length}, Skipped: ${skipped}, Source: ${source}`);

    // Enqueue notification if new events were created
    if (inserted.length > 0 && !dryrun) {
      await enqueueNotification(supabase, brandId, inserted.length);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        dryrun,
        source,
        scanned: facilities.length,
        violations_found: violationFacilities.length,
        inserted: inserted.length,
        skipped,
        event_ids: inserted 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('[fetch-epa-events] Unexpected error:', error);
    
    // Log structured error for monitoring
    console.error(JSON.stringify({
      level: "error",
      fn: "fetch-epa-events",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }));
    
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
