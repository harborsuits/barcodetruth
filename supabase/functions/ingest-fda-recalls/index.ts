import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RELEVANCE_MAX_SCORE } from "../_shared/scoringConstants.ts";

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

    console.log(`[ingest-fda-recalls] Starting for brand_id=${brandId}`);

    // Check feature flag
    const { data: config } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'ingest_fda_enabled')
      .maybeSingle();

    if (config?.value === false) {
      console.log('[FDA] Ingestion disabled via feature flag');
      return new Response(
        JSON.stringify({ 
          success: true, 
          scanned: 0, 
          inserted: 0, 
          skipped: 0, 
          note: 'FDA ingestion disabled' 
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
      console.error('[ingest-fda-recalls] Brand not found:', brandError);
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchQuery = queryOverride || brand.name;
    console.log(`[ingest-fda-recalls] Searching FDA for: ${searchQuery}`);

    let scanned = 0;
    let skipped = 0;
    const events: any[] = [];
    const maxScan = 50;

    try {
      // Query FDA enforcement API
      const fdaUrl = `https://api.fda.gov/food/enforcement.json?search=recalling_firm:"${encodeURIComponent(searchQuery)}"&limit=${maxScan}`;
      
      console.log(`[ingest-fda-recalls] Fetching: ${fdaUrl}`);
      
      const fdaResponse = await fetch(fdaUrl);

      if (!fdaResponse.ok) {
        if (fdaResponse.status === 404) {
          console.log(`[ingest-fda-recalls] No recalls found for ${searchQuery}`);
          return new Response(
            JSON.stringify({ 
              success: true, 
              scanned: 0, 
              inserted: 0, 
              skipped: 0,
              note: 'No recalls found'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        console.error(`[ingest-fda-recalls] FDA API error: ${fdaResponse.status}`);
        return new Response(
          JSON.stringify({ 
            success: true, 
            scanned: 0, 
            inserted: 0, 
            skipped: 0,
            note: 'FDA API unavailable'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const fdaData = await fdaResponse.json();
      const recalls = fdaData?.results || [];

      console.log(`[ingest-fda-recalls] Found ${recalls.length} recalls`);

      for (const recall of recalls) {
        if (scanned >= maxScan) break;
        scanned++;

        const recallNumber = recall.recall_number;
        if (!recallNumber) {
          skipped++;
          continue;
        }

        // Build source URL - FDA recall detail page
        const sourceUrl = `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts`;
        const uniqueUrl = `${sourceUrl}#${recallNumber}`;

        // Check if this event already exists (dedupe by source_url)
        const { data: existing } = await supabase
          .from('brand_events')
          .select('event_id')
          .eq('source_url', uniqueUrl)
          .maybeSingle();

        if (existing) {
          console.log(`[ingest-fda-recalls] Skipping duplicate: ${uniqueUrl}`);
          skipped++;
          continue;
        }

        // Map classification to impact
        const classification = recall.classification || '';
        let impactSocial = -2; // Default
        if (classification === 'Class I') impactSocial = -5; // Serious risk
        else if (classification === 'Class II') impactSocial = -3; // Moderate risk
        else if (classification === 'Class III') impactSocial = -1; // Minor risk

        // Sanitize date with validation
        const sanitizeDate = (dateStr: string | null | undefined): string => {
          if (!dateStr) return new Date().toISOString();
          try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
              console.warn('[FDA] Invalid date:', dateStr, '- using current date');
              return new Date().toISOString();
            }
            return date.toISOString();
          } catch (err) {
            console.warn('[FDA] Date parse error:', dateStr, err);
            return new Date().toISOString();
          }
        };

        // Parse date safely
        const recallDate = recall.recall_initiation_date || recall.report_date;
        const occurredAt = sanitizeDate(recallDate);

        // Build event title and description
        const title = `FDA Recall: ${recall.product_description || 'Product recall'}`;
        const description = `${classification || 'Recall'} - ${recall.reason_for_recall || 'See recall details'}`;

        // Insert event (sanitize raw_data to ensure JSON compatibility)
        const { data: newEvent, error: eventError } = await supabase
          .from('brand_events')
          .insert({
            brand_id: brandId,
            category: 'social',
            verification: 'official',
            orientation: 'negative',
            title,
            description,
            source_url: uniqueUrl,
            occurred_at: occurredAt,
            relevance_score_raw: RELEVANCE_MAX_SCORE, // Official gov data = max relevance
            is_irrelevant: false,
            event_date: occurredAt,
            impact_social: impactSocial,
            raw_data: JSON.parse(JSON.stringify(recall)),
          })
          .select('event_id')
          .single();

        if (eventError) {
          if (eventError.code === '23505') {
            console.log(`[ingest-fda-recalls] Race: duplicate source_url ${uniqueUrl}`);
            skipped++;
            continue;
          }
          console.error('[ingest-fda-recalls] Error inserting event:', eventError);
          continue;
        }

        // Parse URL for registrable domain
        const registrableDomain = (() => {
          try {
            const u = new URL(sourceUrl);
            return u.hostname.replace(/^www\./, '');
          } catch {
            return 'fda.gov';
          }
        })();

        const sourceTitle = (recall.product_description || recall.reason_for_recall || 'Recall').trim();
        const safeTitle = sourceTitle.length >= 4 ? `FDA: ${sourceTitle.substring(0, 100)}` : 'FDA recall record';

        // Insert primary event source with canonical_url
        const { error: sourceError } = await supabase
          .from('event_sources')
          .upsert(
            {
              event_id: newEvent.event_id,
              source_name: 'FDA',
              title: safeTitle,
              source_url: uniqueUrl,
              canonical_url: uniqueUrl,
              domain_owner: 'U.S. Food and Drug Administration',
              registrable_domain: registrableDomain,
              domain_kind: 'official',
              source_date: occurredAt,
              is_primary: true,
              link_kind: 'database',
              article_snippet: `${classification || 'Recall'}: ${recall.reason_for_recall || 'Product safety issue'}`,
            },
            { onConflict: 'event_id,source_url', ignoreDuplicates: true }
          );

        if (sourceError) {
          console.error('[ingest-fda-recalls] Error inserting source:', sourceError);
        }

        console.log(`[ingest-fda-recalls] ✅ evidence_source_primary_inserted: event=${newEvent.event_id}, source=FDA, domain=fda.gov`);
        events.push(newEvent);

        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } catch (error) {
      console.error('[ingest-fda-recalls] Error fetching FDA data:', error);
    }

    console.log(`[ingest-fda-recalls] Scanned: ${scanned}, Inserted: ${events.length}, Skipped: ${skipped}`);

    // If we created any events, enqueue a coalesced push for this brand
    if (events.length > 0) {
      const { data: brandRow } = await supabase
        .from('brands')
        .select('id, name')
        .eq('id', brandId)
        .maybeSingle();

      const bucketSec = Math.floor(Date.now() / (5 * 60 * 1000)) * 5 * 60;
      const coalesceKey = `${brandId}:${bucketSec}`;
      const nowISO = new Date().toISOString();
      
      const payload = {
        brand_id: brandId,
        brand_name: brandRow?.name ?? brandId,
        at: nowISO,
        events: [
          {
            category: 'social',
            delta: -1 * events.length,
          },
        ],
      };

      const { error: upsertErr } = await supabase.rpc('upsert_coalesced_job', {
        p_stage: 'send_push_for_score_change',
        p_key: coalesceKey,
        p_payload: payload,
        p_not_before: nowISO,
      });

      if (upsertErr) {
        console.error('[ingest-fda-recalls] Failed to enqueue coalesced job:', upsertErr);
      } else {
        console.log(
          `[ingest-fda-recalls] Enqueued coalesced job for ${brandRow?.name ?? brandId} (inserted=${events.length})`
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
    console.error('[ingest-fda-recalls] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
