import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const brandId = url.searchParams.get('brand_id');
    const queryOverride = url.searchParams.get('query');

    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brand_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[fetch-osha-events] Starting for brand_id=${brandId}`);

    // Check feature flag
    const { data: config } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'ingest_osha_enabled')
      .maybeSingle();

    if (config?.value === false) {
      console.log('[OSHA] Ingestion disabled via feature flag');
      return new Response(
        JSON.stringify({ 
          success: true, 
          scanned: 0, 
          inserted: 0, 
          skipped: 0, 
          note: 'OSHA ingestion disabled' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve brand name
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name')
      .eq('id', brandId)
      .maybeSingle();

    if (brandError || !brand) {
      console.error('[fetch-osha-events] Brand not found:', brandError);
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchQuery = queryOverride || brand.name;
    console.log(`[fetch-osha-events] Searching OSHA for: ${searchQuery}`);

    // OSHA Enforcement API endpoint
    const oshaApiBase = 'https://data.dol.gov/get/inspection';
    
    let scanned = 0;
    let skipped = 0;
    const events: any[] = [];
    const maxScan = 50;

    try {
      // Query OSHA API for inspections
      const oshaUrl = `${oshaApiBase}?limit=50&estab_name=${encodeURIComponent(searchQuery)}`;
      
      console.log(`[fetch-osha-events] Fetching: ${oshaUrl}`);
      
      const oshaResponse = await fetch(oshaUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!oshaResponse.ok) {
        console.error(`[fetch-osha-events] OSHA API error: ${oshaResponse.status}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            scanned: 0, 
            inserted: 0, 
            skipped: 0,
            note: 'OSHA API unavailable'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const oshaData = await oshaResponse.json();
      const inspections = oshaData?.results || oshaData || [];

      console.log(`[fetch-osha-events] Found ${inspections.length} inspections`);

      for (const inspection of inspections) {
        if (scanned >= maxScan) break;
        scanned++;

        const activityNr = inspection.activity_nr || inspection.inspection_nr;
        if (!activityNr) {
          skipped++;
          continue;
        }

        // Build source URL
        const sourceUrl = `https://www.osha.gov/pls/imis/establishment.inspection_detail?id=${activityNr}`;

        // Check if this event already exists (dedupe by source_url)
        const { data: existing } = await supabase
          .from('brand_events')
          .select('event_id')
          .eq('source_url', sourceUrl)
          .maybeSingle();

        if (existing) {
          console.log(`[fetch-osha-events] Skipping duplicate: ${sourceUrl}`);
          skipped++;
          continue;
        }

        // Parse violation counts
        const serious = parseInt(inspection.nr_serious || '0', 10);
        const willful = parseInt(inspection.nr_willful || '0', 10);
        const repeat = parseInt(inspection.nr_repeat || '0', 10);
        const penalty = parseFloat(inspection.total_current_penalty || '0');

        // Calculate impact_labor (negative scale)
        let impactLabor = -1; // Base negative impact
        if (serious >= 1) impactLabor = -2;
        if (serious >= 3 || penalty >= 25000) impactLabor = -3;
        if (repeat >= 1 || willful >= 1) impactLabor = -4;
        if (willful >= 2 || penalty >= 100000) impactLabor = -5;

        // Parse dates
        const closeDate = inspection.close_case_date || inspection.open_date;
        const occurredAt = closeDate ? new Date(closeDate).toISOString() : new Date().toISOString();

        // Build event title and description
        const violationCount = serious + willful + repeat;
        const title = `OSHA Inspection: ${violationCount} violation${violationCount !== 1 ? 's' : ''} found`;
        
        let description = `OSHA inspection found ${violationCount} violation(s)`;
        if (serious > 0) description += ` including ${serious} serious`;
        if (willful > 0) description += `, ${willful} willful`;
        if (repeat > 0) description += `, ${repeat} repeat`;
        if (penalty > 0) description += `. Total penalty: $${penalty.toLocaleString()}`;
        description += '.';

        // Insert event
        const { data: newEvent, error: eventError } = await supabase
          .from('brand_events')
          .insert({
            brand_id: brandId,
            category: 'labor',
            verification: 'official',
            orientation: 'negative',
            title,
            description,
            source_url: sourceUrl,
            occurred_at: occurredAt,
            event_date: occurredAt,
            impact_labor: impactLabor,
            raw_data: inspection,
          })
          .select('event_id')
          .single();

        if (eventError) {
          if (eventError.code === '23505') {
            // Unique constraint violation (race condition)
            console.log(`[fetch-osha-events] Race: duplicate source_url ${sourceUrl}`);
            skipped++;
            continue;
          }
          console.error('[fetch-osha-events] Error inserting event:', eventError);
          continue;
        }

        // Insert primary event source with full provenance
        const ownerDomain = 'osha.gov';
        const sourceTitle = inspection.case_name 
          || inspection.violation_type 
          || `OSHA Inspection #${activityNr}`;
        
        const { error: sourceError } = await supabase
          .from('event_sources')
          .upsert(
            {
              event_id: newEvent.event_id,
              source_name: 'OSHA',
              title: sourceTitle,
              canonical_url: sourceUrl,
              source_url: sourceUrl,
              owner_domain: ownerDomain,
              source_date: occurredAt,
              is_primary: true,
              link_kind: 'database',
              article_snippet: `Inspection #${activityNr}: ${violationCount} violation(s), $${penalty.toLocaleString()} penalty`,
            },
            { onConflict: 'event_id,canonical_url', ignoreDuplicates: true }
          );

        if (sourceError) {
          console.error('[fetch-osha-events] Error inserting source:', sourceError);
        }

        events.push(newEvent);

        // Rate limit: 150ms between API calls
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } catch (error) {
      console.error('[fetch-osha-events] Error fetching OSHA data:', error);
    }

    console.log(`[fetch-osha-events] Scanned: ${scanned}, Inserted: ${events.length}, Skipped: ${skipped}`);

    // If we created any events, enqueue a coalesced push for this brand
    if (events.length > 0) {
      // Fetch brand name for nicer notification text
      const { data: brandRow } = await supabase
        .from('brands')
        .select('id, name')
        .eq('id', brandId)
        .maybeSingle();

      // 5-minute coalescing bucket key (same pattern as score-change producer)
      const bucketSec = Math.floor(Date.now() / (5 * 60 * 1000)) * 5 * 60;
      const coalesceKey = `${brandId}:${bucketSec}`;

      // Build a concise events summary for payload (labor-only here)
      const nowISO = new Date().toISOString();
      const payload = {
        brand_id: brandId,
        brand_name: brandRow?.name ?? brandId,
        at: nowISO,
        events: [
          {
            category: 'labor',
            // Treat OSHA inserts as a negative movement "signal"; consumer will coalesce.
            delta: -1 * events.length,
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
        console.error('[fetch-osha-events] Failed to enqueue coalesced job:', upsertErr);
      } else {
        console.log(
          `[fetch-osha-events] Enqueued coalesced job for ${brandRow?.name ?? brandId} (inserted=${events.length})`
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        brand: brand.name,
        scanned,
        inserted: events.length,
        skipped,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[fetch-osha-events] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
