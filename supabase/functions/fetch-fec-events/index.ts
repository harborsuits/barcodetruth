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

  if (!brandId) {
    return new Response(
      JSON.stringify({ error: "brand_id is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  console.log(`[FEC] Fetching events for brand_id: ${brandId}`);

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
  const maxScan = 50;
  const events: string[] = [];

  // Calculate date 12 months ago
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const sinceStr = since.toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // Step 1: Find committees by name
    const committeesUrl = `https://api.open.fec.gov/v1/committees/?q=${encodeURIComponent(searchQuery)}&per_page=50&sort=name&api_key=${fecApiKey}`;
    
    console.log(`[FEC] Fetching committees from FEC API`);
    const committeesRes = await fetch(committeesUrl);

    if (!committeesRes.ok) {
      console.error(`[FEC] API request failed: ${committeesRes.status} ${committeesRes.statusText}`);
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

    const committeesJson = await committeesRes.json();
    const committees = committeesJson?.results ?? [];
    console.log(`[FEC] Found ${committees.length} committees`);

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

      // Fetch Schedule B disbursements (to candidates/party committees)
      const disbUrl = `https://api.open.fec.gov/v1/schedules/schedule_b/?committee_id=${cmteId}&disbursement_description=contribution&min_date=${sinceStr}&per_page=50&api_key=${fecApiKey}`;

      const disbRes = await fetch(disbUrl);
      if (!disbRes.ok) {
        console.error(`[FEC] Failed to fetch disbursements for ${cmteId}: ${disbRes.status}`);
        skipped++;
        await new Promise(resolve => setTimeout(resolve, 150));
        continue;
      }

      const disbJson = await disbRes.json();
      const rows = disbJson?.results ?? [];
      console.log(`[FEC] Found ${rows.length} disbursements for ${cmteId}`);

      // Aggregate by party
      let toD = 0;
      let toR = 0;
      let toOther = 0;

      for (const row of rows) {
        const amt = Number(row.disbursement_amount || 0);
        if (!amt) continue;

        const recipientName = (row.recipient_name || '').toUpperCase();
        const party = (row.recipient_committee_type || '').toUpperCase();

        // Simple heuristic for party detection
        if (recipientName.includes('DEMOCRATIC') || recipientName.includes('DEM ') || party.includes('DEM')) {
          toD += amt;
        } else if (recipientName.includes('REPUBLICAN') || recipientName.includes('GOP') || party.includes('REP')) {
          toR += amt;
        } else {
          toOther += amt;
        }
      }

      const total = toD + toR;
      if (total <= 0) {
        console.log(`[FEC] No significant disbursements for ${cmteId}`);
        skipped++;
        await new Promise(resolve => setTimeout(resolve, 150));
        continue;
      }

      const tiltAmt = Math.max(toD, toR);
      const tilt = tiltAmt / (total + 1); // 0..1 with smoothing
      console.log(`[FEC] Tilt for ${cmteId}: ${(tilt * 100).toFixed(1)}% (D: $${toD}, R: $${toR})`);

      // Impact mapping
      let impact = -1;
      if (tilt >= 0.85) impact = -5;
      else if (tilt >= 0.70) impact = -4;
      else if (tilt >= 0.60) impact = -3;
      else if (tilt >= 0.55) impact = -2;

      const lean = toR > toD ? "Republican" : "Democratic";
      const title = `FEC: ${lean} donation tilt over last 12 months`;
      const description = `Disbursements — ${lean} $${Math.round(tiltAmt).toLocaleString()} vs other $${Math.round(total - tiltAmt).toLocaleString()}.`;
      
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
        await new Promise(resolve => setTimeout(resolve, 150));
        continue;
      }

      // Insert event
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
            committee: committee,
            disbursements: rows.slice(0, 10),
            totals: { democratic: toD, republican: toR, other: toOther }
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
        await new Promise(resolve => setTimeout(resolve, 150));
        continue;
      }

      console.log(`[FEC] Inserted event ${newEvent.event_id}`);

      // Insert source attribution
      const { error: sourceError } = await supabase
        .from("event_sources")
        .insert({
          event_id: newEvent.event_id,
          source_name: "FEC",
          source_url: sourceUrl,
          source_date: occurredAt,
          quote: `${lean} tilt: ${(tilt * 100).toFixed(0)}%`
        });

      if (sourceError) {
        console.error(`[FEC] Failed to insert source:`, sourceError);
      }

      events.push(newEvent.event_id);
      inserted++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 150));
    }

    // Enqueue coalesced push notification if any events were inserted
    if (inserted > 0) {
      console.log(`[FEC] Enqueuing coalesced push notification for ${inserted} new events`);
      
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
          events: [{ category: "politics", delta: -1 * inserted }]
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
        skipped
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
