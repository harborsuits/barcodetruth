import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const fecApiKey = Deno.env.get("FEC_API_KEY");

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase environment variables");
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!fecApiKey) {
    console.error("Missing FEC_API_KEY");
    return new Response(
      JSON.stringify({ error: "FEC API key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand_id");
  const queryOverride = url.searchParams.get("query");
  const dryRun = url.searchParams.get("dryrun") === "1";

  if (!brandId) {
    return new Response(
      JSON.stringify({ error: "brand_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[FEC] Fetching events for brand_id: ${brandId}`);

  // Check feature flag
  const { data: config } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "ingest_fec_enabled")
    .maybeSingle();

  if (config?.value === false) {
    console.log("[FEC] Ingestion disabled via feature flag");
    return new Response(
      JSON.stringify({ 
        success: true, 
        scanned: 0, 
        inserted: 0, 
        skipped: 0, 
        note: "FEC ingestion disabled" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Fetch brand details
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id, name")
    .eq("id", brandId)
    .maybeSingle();

  if (brandError || !brand) {
    console.error("[FEC] Brand not found:", brandError);
    return new Response(
      JSON.stringify({ error: "Brand not found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const searchQuery = queryOverride || brand.name;
  console.log(`[FEC] Searching for committees matching: ${searchQuery}`);

  let scanned = 0;
  let inserted = 0;
  let skipped = 0;
  const maxScan = 200;
  const eventsWithImpact: Array<{ id: string; impact: number }> = [];

  // Calculate date 12 months ago
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const sinceStr = since.toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // Step 1: Find committees by name with pagination
    const committees: any[] = [];
    let page = 1;
    const perPage = 50;
    
    console.log(`[FEC] Fetching committees from FEC API`);
    
    while (committees.length < maxScan) {
      const committeesUrl = `https://api.open.fec.gov/v1/committees/?q=${encodeURIComponent(searchQuery)}&per_page=${perPage}&page=${page}&sort=name&api_key=${fecApiKey}`;
      
      let committeesRes = await fetch(committeesUrl);

      // Handle rate limiting with backoff
      if (committeesRes.status === 429) {
        console.log(`[FEC] ⚠️ 429 rate limit hit on committees page ${page}, retrying after 500ms backoff`);
        await new Promise(resolve => setTimeout(resolve, 500));
        committeesRes = await fetch(committeesUrl);
      }

      if (!committeesRes.ok) {
        console.error(`[FEC] API request failed: ${committeesRes.status} ${committeesRes.statusText}`);
        if (page === 1) {
          return new Response(
            JSON.stringify({ 
              success: true, 
              brand: brand.name, 
              scanned: 0, 
              inserted: 0, 
              skipped: 0,
              note: "FEC API unavailable" 
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }

      const committeesJson = await committeesRes.json();
      const pageResults = committeesJson?.results ?? [];
      
      if (pageResults.length === 0) break;
      
      committees.push(...pageResults);
      console.log(`[FEC] Fetched page ${page}: ${pageResults.length} committees (total: ${committees.length})`);
      
      if (pageResults.length < perPage) break;
      
      page++;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    console.log(`[FEC] Found ${committees.length} total committees`);

    // Step 2: Process each committee
    for (const committee of committees) {
      if (scanned >= maxScan) {
        console.log(`[FEC] Reached max scan limit of ${maxScan}`);
        break;
      }

      scanned++;
      const cmteId = committee.committee_id;
      
      if (!cmteId) {
        skipped++;
        continue;
      }

      console.log(`[FEC] Processing committee: ${cmteId} - ${committee.name || 'unnamed'}`);

      // Fetch Schedule B disbursements with pagination
      const allDisbursements: any[] = [];
      let disbPage = 1;
      const disbPerPage = 100;
      
      while (allDisbursements.length < 200) {
        const disbUrl = `https://api.open.fec.gov/v1/schedules/schedule_b/?committee_id=${cmteId}&disbursement_description=contribution&min_date=${sinceStr}&per_page=${disbPerPage}&page=${disbPage}&api_key=${fecApiKey}`;

        let disbRes = await fetch(disbUrl);
        
        // Handle rate limiting with backoff
        if (disbRes.status === 429) {
          console.log(`[FEC] ⚠️ 429 rate limit hit on disbursements for ${cmteId} page ${disbPage}, retrying after 500ms backoff`);
          await new Promise(resolve => setTimeout(resolve, 500));
          disbRes = await fetch(disbUrl);
        }
        
        if (!disbRes.ok) {
          console.error(`[FEC] Failed to fetch disbursements for ${cmteId}: ${disbRes.status}`);
          break;
        }

        const disbJson = await disbRes.json();
        const pageResults = disbJson?.results ?? [];
        
        if (pageResults.length === 0) break;
        
        allDisbursements.push(...pageResults);
        
        if (pageResults.length < disbPerPage) break;
        
        disbPage++;
        await new Promise(resolve => setTimeout(resolve, 150));
      }

      console.log(`[FEC] Found ${allDisbursements.length} total disbursements for ${cmteId}`);

      if (allDisbursements.length === 0) {
        skipped++;
        continue;
      }

      // Aggregate by party using proper FEC fields
      let toD = 0;
      let toR = 0;
      let toOther = 0;

      for (const row of allDisbursements) {
        const amt = Number(row.disbursement_amount || 0);
        if (!amt) continue;

        // Prefer FEC party fields over string matching
        const recipientParty = (row.recipient_party || '').toUpperCase();
        const recipientCommitteeParty = (row.recipient_committee_party || '').toUpperCase();
        const recipientName = (row.recipient_name || '').toUpperCase();

        // Party detection logic: use fields first, fall back to name matching
        let party = recipientParty || recipientCommitteeParty;
        
        if (!party) {
          // Fallback to name matching
          if (recipientName.includes('DEMOCRATIC') || recipientName.includes('DEM ') || recipientName.includes('DNC')) {
            party = 'DEM';
          } else if (recipientName.includes('REPUBLICAN') || recipientName.includes('GOP') || recipientName.includes('RNC')) {
            party = 'REP';
          }
        }

        if (party.includes('DEM')) {
          toD += amt;
        } else if (party.includes('REP')) {
          toR += amt;
        } else {
          toOther += amt;
        }
      }

      const total = toD + toR;
      if (total <= 0) {
        console.log(`[FEC] No significant partisan disbursements for ${cmteId}`);
        skipped++;
        continue;
      }

      const tiltAmt = Math.max(toD, toR);
      const tilt = tiltAmt / (total + 1); // 0..1 with smoothing
      const tiltPct = Math.round(tilt * 100);
      
      console.log(`[FEC] Tilt for ${cmteId}: ${tiltPct}% (D: $${toD.toLocaleString()}, R: $${toR.toLocaleString()})`);

      // Impact mapping
      let impact = -1;
      if (tilt >= 0.85) impact = -5;
      else if (tilt >= 0.70) impact = -4;
      else if (tilt >= 0.60) impact = -3;
      else if (tilt >= 0.55) impact = -2;

      const lean = toR > toD ? "Republican" : "Democratic";
      const title = `FEC: ${lean} donation tilt over last 12 months`;
      const description = `Disbursements — ${lean} $${Math.round(tiltAmt).toLocaleString()} vs other $${Math.round(total - tiltAmt).toLocaleString()}. Tilt: ${tiltPct}%.`;
      
      // Use committee detail page as source URL (unique per committee)
      const sourceUrl = `https://www.fec.gov/data/committee/${cmteId}/`;

      // Check for existing event with this source_url (dedupe)
      const { data: existing } = await supabase
        .from("brand_events")
        .select("event_id")
        .eq("source_url", sourceUrl)
        .maybeSingle();

      if (existing) {
        console.log(`[FEC] Event already exists for ${sourceUrl}`);
        skipped++;
        continue;
      }

      // Dry-run mode: skip inserts
      if (dryRun) {
        console.log(`[FEC] [DRY-RUN] Would insert event for ${cmteId} with impact ${impact}`);
        inserted++;
        eventsWithImpact.push({ id: `dry-run-${cmteId}`, impact });
        continue;
      }

      // Insert event with tilt metrics
      const occurredAt = new Date().toISOString();
      const { data: newEvent, error: eventError } = await supabase
        .from("brand_events")
        .insert({
          brand_id: brandId,
          category: "politics",
          verification: "official",
          orientation: "negative",
          title,
          description,
          source_url: sourceUrl,
          occurred_at: occurredAt,
          event_date: occurredAt,
          impact_politics: impact,
          raw_data: {
            committee_id: cmteId,
            committee_name: committee.name,
            tilt_pct: tiltPct,
            dem_total: toD,
            rep_total: toR,
            other_total: toOther,
            lean: lean,
            committee: committee,
            disbursements_sample: allDisbursements.slice(0, 10)
          }
        })
        .select("event_id")
        .single();

      if (eventError) {
        if (eventError.code === "23505") {
          console.log(`[FEC] Unique constraint violation for ${sourceUrl} (race condition)`);
          skipped++;
        } else {
          console.error(`[FEC] Failed to insert event:`, eventError);
          skipped++;
        }
        continue;
      }

      console.log(`[FEC] Inserted event ${newEvent.event_id} with impact ${impact}`);

      // Insert source attribution
      const { error: sourceError } = await supabase
        .from("event_sources")
        .insert({
          event_id: newEvent.event_id,
          source_name: "FEC",
          source_url: sourceUrl,
          source_date: occurredAt,
          quote: `${lean} tilt: ${tiltPct}% ($${Math.round(tiltAmt / 1000)}K of $${Math.round(total / 1000)}K)`
        });

      if (sourceError) {
        console.error(`[FEC] Failed to insert source:`, sourceError);
      }

      eventsWithImpact.push({ id: newEvent.event_id, impact });
      inserted++;
    }

    // Enqueue coalesced push notification if any events were inserted
    if (inserted > 0) {
      // Calculate total impact (sum of all impact_politics values)
      const totalImpact = eventsWithImpact.reduce((sum, e) => sum + e.impact, 0);
      const delta = Math.round(totalImpact);
      
      console.log(`[FEC] Enqueuing coalesced push notification for ${inserted} new events (delta: ${delta})`);
      
      const bucketSec = Math.floor(Date.now() / (5 * 60 * 1000)) * 5 * 60;
      const coalesceKey = `${brandId}:${bucketSec}`;
      const nowISO = new Date().toISOString();

      const { error: jobError } = await supabase.rpc("upsert_coalesced_job", {
        p_stage: "send_push_for_score_change",
        p_key: coalesceKey,
        p_payload: {
          brand_id: brandId,
          brand_name: brand.name,
          at: nowISO,
          events: [{ category: "politics", delta }]
        },
        p_not_before: nowISO
      });

      if (jobError) {
        console.error(`[FEC] Failed to enqueue push notification:`, jobError);
      }
    }

    console.log(`[FEC] Complete - Scanned: ${scanned}, Inserted: ${inserted}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        brand: brand.name,
        scanned,
        inserted,
        skipped,
        dry_run: dryRun
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[FEC] Unexpected error:", error);
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
