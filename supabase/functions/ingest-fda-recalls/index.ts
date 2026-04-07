import { createClient } from "npm:@supabase/supabase-js@2";
import { RELEVANCE_MAX_SCORE } from "../_shared/scoringConstants.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// All three FDA enforcement endpoints
const FDA_ENDPOINTS = [
  { endpoint: 'food/enforcement.json', label: 'Food', firmField: 'recalling_firm' },
  { endpoint: 'drug/enforcement.json', label: 'Drug', firmField: 'recalling_firm' },
  { endpoint: 'device/enforcement.json', label: 'Device', firmField: 'recalling_firm' },
];

function sanitizeDate(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString();
  try {
    // FDA dates are often YYYYMMDD format
    if (/^\d{8}$/.test(dateStr)) {
      const y = dateStr.slice(0, 4);
      const m = dateStr.slice(4, 6);
      const d = dateStr.slice(6, 8);
      return new Date(`${y}-${m}-${d}`).toISOString();
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// ── Brand-specific entity mismatch guards ──────────────────────────────
// These patterns indicate a recall is NOT about the target brand
const BRAND_EXCLUSION_PATTERNS: Record<string, RegExp[]> = {
  'Crest': [/cedar\s*crest/i, /royal\s*crest/i, /crest\s*foods/i, /crest\s*dairy/i, /gold\s*crest/i, /sun\s*crest/i],
  'Dove': [/dove\s*(bar|chocolate|ice\s*cream)/i, /dove\s*promises/i],
  'Pampers': [/\b(secret|old\s*spice|vicks|nyquil|dayquil|gillette|oral-b|bounce|downy|febreze|swiffer|charmin|bounty|dawn|cascade|mr\.\s*clean|gain|dreft|align|meta|zzzquil)\b/i],
};

// These patterns MUST appear in the product description for sub-brand attribution
const BRAND_REQUIRED_PATTERNS: Record<string, RegExp> = {
  'Crest': /\bcrest\b/i,
  'Pampers': /\bpampers\b/i,
  'Dove': /\bdove\b/i,
  'Oreo': /\boreo\b/i,
  'Cheerios': /\bcheerios\b/i,
};

function isEntityMismatch(brandName: string, recall: any): boolean {
  const productDesc = (recall.product_description || '').toLowerCase();
  const reasonStr = (recall.reason_for_recall || '').toLowerCase();
  const combined = `${productDesc} ${reasonStr}`;

  // Check exclusion patterns
  const exclusions = BRAND_EXCLUSION_PATTERNS[brandName];
  if (exclusions) {
    for (const pattern of exclusions) {
      if (pattern.test(combined)) return true;
    }
  }

  // Check required patterns: if brand has a required pattern,
  // the product/reason must mention it
  const required = BRAND_REQUIRED_PATTERNS[brandName];
  if (required) {
    if (!required.test(combined)) return true;
  }

  return false;
}

function classificationToImpact(classification: string): number {
  if (classification === 'Class I') return -5;
  if (classification === 'Class II') return -3;
  if (classification === 'Class III') return -1;
  return -2;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const brandId = url.searchParams.get('brand_id');
    const queryOverride = url.searchParams.get('query') || url.searchParams.get('queryOverride');

    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brand_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[ingest-fda] Starting for brand_id=${brandId}`);

    // Check feature flag
    const { data: config } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'ingest_fda_enabled')
      .maybeSingle();

    if (config?.value === false) {
      return new Response(
        JSON.stringify({ success: true, scanned: 0, inserted: 0, skipped: 0, note: 'FDA ingestion disabled' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve brand name + aliases for broader matching
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, parent_company')
      .eq('id', brandId)
      .maybeSingle();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build search queries from brand name + aliases
    const searchQueries: string[] = [];
    if (queryOverride) {
      searchQueries.push(queryOverride);
    } else {
      searchQueries.push(brand.name);
      // Also search parent company if available
      if (brand.parent_company) {
        searchQueries.push(brand.parent_company);
      }
      // Fetch aliases for broader matching
      const { data: aliases } = await supabase
        .from('brand_aliases')
        .select('external_name')
        .eq('canonical_brand_id', brandId)
        .limit(5);
      if (aliases) {
        for (const a of aliases) {
          if (a.external_name && !searchQueries.includes(a.external_name)) {
            searchQueries.push(a.external_name);
          }
        }
      }
    }

    console.log(`[ingest-fda] Search queries: ${searchQueries.join(', ')}`);

    let totalScanned = 0;
    let totalSkipped = 0;
    let totalMismatched = 0;
    const allEvents: any[] = [];
    const maxPerEndpoint = 30;

    // Search all three FDA endpoints with all queries
    // Search BOTH recalling_firm AND product_description for better sub-brand coverage
    const searchFields = ['recalling_firm', 'product_description'];
    for (const ep of FDA_ENDPOINTS) {
      for (const searchQuery of searchQueries) {
        for (const searchField of searchFields) {
        if (totalScanned >= 150) break; // Global cap

        try {
          const fdaUrl = `https://api.fda.gov/${ep.endpoint}?search=${searchField}:"${encodeURIComponent(searchQuery)}"&limit=${maxPerEndpoint}`;
          console.log(`[ingest-fda] [${ep.label}] Fetching ${searchField} for "${searchQuery}"`);

          const fdaResponse = await fetch(fdaUrl);

          if (!fdaResponse.ok) {
            if (fdaResponse.status === 404) {
              console.log(`[ingest-fda] [${ep.label}] No recalls for "${searchQuery}"`);
              continue;
            }
            console.warn(`[ingest-fda] [${ep.label}] API error: ${fdaResponse.status}`);
            continue;
          }

          const fdaData = await fdaResponse.json();
          const recalls = fdaData?.results || [];
          console.log(`[ingest-fda] [${ep.label}] Found ${recalls.length} recalls for "${searchQuery}"`);

          for (const recall of recalls) {
            totalScanned++;
            if (totalScanned > 100) break;

            const recallNumber = recall.recall_number;
            if (!recallNumber) { totalSkipped++; continue; }

            // Entity mismatch guard: reject recalls that don't actually mention this brand
            if (isEntityMismatch(brand.name, recall)) {
              totalMismatched++;
              console.log(`[ingest-fda] ⛔ Mismatch rejected: "${(recall.product_description || '').substring(0, 60)}" is not ${brand.name}`);
              continue;
            }

            const sourceUrl = `https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts`;
            const uniqueUrl = `${sourceUrl}#${recallNumber}`;

            // Deduplicate
            const { data: existing } = await supabase
              .from('brand_events')
              .select('event_id')
              .eq('source_url', uniqueUrl)
              .maybeSingle();

            if (existing) { totalSkipped++; continue; }

            const classification = recall.classification || '';
            const impactSocial = classificationToImpact(classification);
            const recallDate = recall.recall_initiation_date || recall.report_date;
            const occurredAt = sanitizeDate(recallDate);

            const productDesc = (recall.product_description || 'Product recall').substring(0, 200);
            const title = `FDA ${ep.label} Recall: ${productDesc}`;
            const description = `${classification || 'Recall'} - ${recall.reason_for_recall || 'See recall details'}`;

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
                relevance_score_raw: RELEVANCE_MAX_SCORE,
                is_irrelevant: false,
                event_date: occurredAt,
                impact_social: impactSocial,
                raw_data: JSON.parse(JSON.stringify(recall)),
              })
              .select('event_id')
              .single();

            if (eventError) {
              if (eventError.code === '23505') { totalSkipped++; continue; }
              console.error('[ingest-fda] Insert error:', eventError);
              continue;
            }

            const sourceTitle = `FDA ${ep.label}: ${(recall.reason_for_recall || productDesc).substring(0, 100)}`;

            await supabase
              .from('event_sources')
              .upsert(
                {
                  event_id: newEvent.event_id,
                  source_name: 'FDA',
                  title: sourceTitle.length >= 4 ? sourceTitle : 'FDA recall record',
                  source_url: uniqueUrl,
                  canonical_url: uniqueUrl,
                  domain_owner: 'U.S. Food and Drug Administration',
                  registrable_domain: 'fda.gov',
                  domain_kind: 'official',
                  source_date: occurredAt,
                  is_primary: true,
                  link_kind: 'database',
                  article_snippet: `${classification || 'Recall'}: ${recall.reason_for_recall || 'Product safety issue'}`,
                },
                { onConflict: 'event_id,source_url', ignoreDuplicates: true }
              );

            console.log(`[ingest-fda] ✅ [${ep.label}] event=${newEvent.event_id}`);
            allEvents.push(newEvent);

            await new Promise(resolve => setTimeout(resolve, 120));
          }
        } catch (error) {
          console.error(`[ingest-fda] [${ep.label}] Error for "${searchQuery}":`, error);
        }

        // Rate limit between queries
        await new Promise(resolve => setTimeout(resolve, 200));
        } // end searchFields loop
      }
    }

    console.log(`[ingest-fda] Done: scanned=${totalScanned}, inserted=${allEvents.length}, skipped=${totalSkipped}, mismatched=${totalMismatched}`);

    // Enqueue coalesced push if events were created
    if (allEvents.length > 0) {
      const bucketSec = Math.floor(Date.now() / (5 * 60 * 1000)) * 5 * 60;
      const coalesceKey = `${brandId}:${bucketSec}`;
      const nowISO = new Date().toISOString();

      await supabase.rpc('upsert_coalesced_job', {
        p_stage: 'send_push_for_score_change',
        p_key: coalesceKey,
        p_payload: {
          brand_id: brandId,
          brand_name: brand.name,
          at: nowISO,
          events: [{ category: 'social', delta: -1 * allEvents.length }],
        },
        p_not_before: nowISO,
      }).catch(e => console.error('[ingest-fda] Coalesced job error:', e));
    }

    return new Response(
      JSON.stringify({
        success: true,
        brand: brand.name,
        scanned: totalScanned,
        inserted: allEvents.length,
        skipped: totalSkipped,
        mismatched: totalMismatched,
        endpoints_searched: FDA_ENDPOINTS.map(e => e.label),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[ingest-fda] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
