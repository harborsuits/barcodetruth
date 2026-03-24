import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  loadMatchCache,
  matchFirmToBrand,
  normalizeFirmName,
  type BrandMatch,
} from "../_shared/companyMatcher.ts";
import { RELEVANCE_MAX_SCORE } from "../_shared/scoringConstants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Bulk OSHA Historical Ingestion
 *
 * Pulls from OSHA's enforcement data API which exposes the full inspection
 * and citation archive (34k+ inspections/year, decades of history).
 *
 * Two endpoints used:
 *   1. https://enforcedata.dol.gov/api/enhanced_osha/inspection  — inspections
 *   2. https://enforcedata.dol.gov/api/enhanced_osha/violation   — citations
 *
 * Records are matched through the company graph and inserted as labor events.
 *
 * Query params:
 *   page       — pagination offset (default 0)
 *   per_page   — records per page (default 250, max 250)
 *   start_date — YYYY-MM-DD lower bound for open_date (default: 2020-01-01)
 *   end_date   — YYYY-MM-DD upper bound (default: today)
 *   sic_code   — optional SIC industry code filter
 *   state      — optional 2-letter state filter
 *   mode       — "inspection" (default) or "violation"
 */

const DOL_BASE = "https://enforcedata.dol.gov/api/enhanced_osha";
const MAX_PER_PAGE = 250;

interface InspResult {
  matched: number;
  inserted: number;
  skipped: number;
  queued: number;
  noMatch: number;
  errors: number;
  total: number;
}

function calcImpact(insp: Record<string, unknown>): number {
  const penalty = Number(insp.total_current_penalty || insp.penalty_total || 0);
  const serious = Number(insp.nr_serious || 0);
  const willful = Number(insp.nr_willful || 0);
  const repeat = Number(insp.nr_repeat || 0);

  if (willful >= 2 || penalty >= 100_000) return -5;
  if (repeat >= 1 || willful >= 1) return -4;
  if (serious >= 3 || penalty >= 25_000) return -3;
  if (serious >= 1) return -2;
  return -1;
}

function sanitizeDate(d: string | null | undefined): string {
  if (!d) return new Date().toISOString();
  try {
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "0", 10);
    const perPage = Math.min(parseInt(url.searchParams.get("per_page") || "250", 10), MAX_PER_PAGE);
    const startDate = url.searchParams.get("start_date") || "2020-01-01";
    const endDate = url.searchParams.get("end_date") || new Date().toISOString().slice(0, 10);
    const sicCode = url.searchParams.get("sic_code") || "";
    const stateFilter = url.searchParams.get("state") || "";
    const mode = url.searchParams.get("mode") || "inspection";

    console.log(`[osha-historical] mode=${mode} page=${page} per_page=${perPage} range=${startDate}..${endDate}`);

    // Check feature flag
    const { data: config } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "ingest_osha_historical_enabled")
      .maybeSingle();

    if (config?.value === false) {
      return new Response(
        JSON.stringify({ success: true, note: "OSHA historical ingestion disabled", ...emptyResult() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the company graph for matching
    await loadMatchCache(supabase);

    // Build DOL API query
    const endpoint = mode === "violation" ? "violation" : "inspection";
    const params = new URLSearchParams({
      per_page: String(perPage),
      page: String(page),
    });

    // Date filters
    if (startDate) params.set("open_date_from", startDate);
    if (endDate) params.set("open_date_to", endDate);
    if (sicCode) params.set("sic_code", sicCode);
    if (stateFilter) params.set("site_state", stateFilter);

    const apiUrl = `${DOL_BASE}/${endpoint}?${params.toString()}`;
    console.log(`[osha-historical] Fetching: ${apiUrl}`);

    const dolApiKey = Deno.env.get("DOL_API_KEY");
    const headers: Record<string, string> = { Accept: "application/json" };
    if (dolApiKey) headers["X-API-KEY"] = dolApiKey;

    const resp = await fetch(apiUrl, { headers });

    if (!resp.ok) {
      console.error(`[osha-historical] DOL API returned ${resp.status}`);
      return new Response(
        JSON.stringify({ success: false, error: `DOL API ${resp.status}`, ...emptyResult() }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const raw = await resp.json();
    const inspections = Array.isArray(raw) ? raw : raw?.results || raw?.data || [];
    console.log(`[osha-historical] Fetched ${inspections.length} records`);

    const result: InspResult = { matched: 0, inserted: 0, skipped: 0, queued: 0, noMatch: 0, errors: 0, total: inspections.length };

    for (const insp of inspections) {
      const firmName = (insp.estab_name || insp.establishment_name || "").toString().trim();
      if (!firmName) { result.skipped++; continue; }

      const activityNr = insp.activity_nr || insp.inspection_nr || insp.citation_id || "";
      if (!activityNr) { result.skipped++; continue; }

      // Match through company graph
      const match = matchFirmToBrand(firmName);

      if (!match) {
        result.noMatch++;
        continue;
      }

      // High-confidence → insert
      if (match.confidence === "exact" || match.confidence === "alias" || match.confidence === "parent" ||
          (match.confidence === "fuzzy" && match.score >= 0.85)) {

        const sourceUrl = `https://www.osha.gov/pls/imis/establishment.inspection_detail?id=${activityNr}`;

        // Dedupe
        const { data: existing } = await supabase
          .from("brand_events")
          .select("event_id")
          .eq("source_url", sourceUrl)
          .maybeSingle();

        if (existing) {
          result.skipped++;
          result.matched++;
          continue;
        }

        const impact = calcImpact(insp);
        const penalty = Number(insp.total_current_penalty || insp.penalty_total || 0);
        const serious = Number(insp.nr_serious || 0);
        const willful = Number(insp.nr_willful || 0);
        const repeat_ = Number(insp.nr_repeat || 0);
        const violCount = serious + willful + repeat_;
        const occurredAt = sanitizeDate(insp.close_case_date || insp.open_date);

        const title = violCount > 0
          ? `OSHA Inspection: ${violCount} violation${violCount !== 1 ? "s" : ""} at ${firmName.substring(0, 80)}`
          : `OSHA Inspection: ${firmName.substring(0, 120)}`;

        let description = `OSHA inspection of ${firmName}`;
        if (insp.site_city) description += ` in ${insp.site_city}, ${insp.site_state || ""}`;
        if (violCount > 0) description += `. ${violCount} violation(s)`;
        if (serious > 0) description += ` including ${serious} serious`;
        if (willful > 0) description += `, ${willful} willful`;
        if (penalty > 0) description += `. Penalty: $${penalty.toLocaleString()}`;
        description += ".";

        const { error: insertErr } = await supabase
          .from("brand_events")
          .insert({
            brand_id: match.brandId,
            category: "labor",
            verification: "official",
            orientation: "negative",
            title: title.substring(0, 500),
            description: description.substring(0, 2000),
            source_url: sourceUrl,
            occurred_at: occurredAt,
            relevance_score_raw: RELEVANCE_MAX_SCORE,
            is_irrelevant: false,
            event_date: occurredAt,
            impact_labor: impact,
            raw_data: JSON.parse(JSON.stringify(insp)),
          });

        if (insertErr) {
          if (insertErr.code === "23505") { result.skipped++; } else { result.errors++; }
        } else {
          result.inserted++;
          console.log(`[osha-historical] ✅ "${firmName}" → ${match.brandName} (${match.matchedVia})`);
        }
        result.matched++;
      }
      // Low-confidence fuzzy → queue for review
      else if (match.confidence === "fuzzy") {
        await supabase
          .from("regulatory_match_review")
          .upsert(
            {
              firm_name: firmName,
              normalized_firm: normalizeFirmName(firmName),
              source_adapter: "osha-historical",
              source_record_id: String(activityNr),
              suggested_brand_id: match.brandId,
              suggested_brand_name: match.brandName,
              match_confidence: "fuzzy",
              similarity_score: match.score,
              matched_via: match.matchedVia,
              record_title: `OSHA Inspection #${activityNr}`,
              record_date: sanitizeDate(insp.open_date),
              raw_data: JSON.parse(JSON.stringify(insp)),
            },
            { onConflict: "source_adapter,source_record_id", ignoreDuplicates: true }
          );
        result.queued++;
      }

      // Rate limit: don't hammer the DB
      if (result.inserted % 50 === 0 && result.inserted > 0) {
        await new Promise(r => setTimeout(r, 200));
      }
    }

    console.log(`[osha-historical] Done: total=${result.total} matched=${result.matched} inserted=${result.inserted} queued=${result.queued} noMatch=${result.noMatch}`);

    return new Response(
      JSON.stringify({
        success: true,
        page,
        per_page: perPage,
        start_date: startDate,
        end_date: endDate,
        has_more: inspections.length === perPage,
        ...result,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[osha-historical] Fatal:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function emptyResult(): InspResult {
  return { matched: 0, inserted: 0, skipped: 0, queued: 0, noMatch: 0, errors: 0, total: 0 };
}
