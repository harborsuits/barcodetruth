/**
 * Bulk Regulatory Ingestion Orchestrator
 * 
 * Two modes:
 *   1. Brand-targeted (default): Run adapters against activation queue brands
 *   2. Discovery: Fetch broadly, resolve firm names via company matcher
 * 
 * POST body:
 *   mode: 'targeted' | 'discovery' (default: 'targeted')
 *   batch_size: number (default 30, max 100) 
 *   tier: 'near_ready' | 'fast_follow' | 'all'
 *   sources: string[] (adapter IDs)
 *   brand_id: string (single brand override)
 *   search_terms: string[] (for discovery mode, e.g. ["food", "cosmetics"])
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { runAllAdapters, runDiscovery, type PipelineResult, type DiscoveryResult } from "../_shared/regulatoryPipeline.ts";
import { getAdapters } from "../_shared/sourceAdapters.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let mode = 'targeted';
    let batchSize = 30;
    let tierFilter = 'all';
    let sourceIds: string[] | undefined;
    let singleBrandId: string | undefined;
    let searchTerms: string[] = [];

    try {
      const body = await req.json();
      if (body.mode) mode = body.mode;
      if (body.batch_size) batchSize = Math.min(body.batch_size, 100);
      if (body.tier) tierFilter = body.tier;
      if (body.sources) sourceIds = body.sources;
      if (body.brand_id) singleBrandId = body.brand_id;
      if (body.search_terms) searchTerms = body.search_terms;
    } catch { /* no body */ }

    const adapters = getAdapters(sourceIds);
    console.log(`[bulk-regulatory] Mode: ${mode}, Sources: ${adapters.map(a => a.id).join(', ')}`);

    // ── Discovery Mode ──────────────────────────────────────────────
    if (mode === 'discovery') {
      if (searchTerms.length === 0) {
        // Default broad search terms for discovery
        searchTerms = ['food', 'beverage', 'cosmetic', 'consumer', 'electronics'];
      }

      const discoveryResults: DiscoveryResult[] = [];
      for (const adapter of adapters) {
        const r = await runDiscovery(supabase, adapter, searchTerms);
        discoveryResults.push(r);
      }

      // Auto-promote after discovery
      const { data: promoted } = await supabase.rpc('promote_eligible_brands');

      const totalInserted = discoveryResults.reduce((s, r) => s + r.inserted, 0);
      const totalQueued = discoveryResults.reduce((s, r) => s + r.queued, 0);

      return new Response(
        JSON.stringify({
          success: true,
          mode: 'discovery',
          search_terms: searchTerms,
          total_records: discoveryResults.reduce((s, r) => s + r.totalRecords, 0),
          total_matched: discoveryResults.reduce((s, r) => s + r.matched, 0),
          total_inserted: totalInserted,
          total_queued_for_review: totalQueued,
          total_no_match: discoveryResults.reduce((s, r) => s + r.noMatch, 0),
          brands_promoted: promoted || 0,
          by_source: discoveryResults,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Targeted Mode ───────────────────────────────────────────────
    let targets: Array<{ brand_id: string; brand_name: string; event_count: number }>;

    if (singleBrandId) {
      const { data: brand } = await supabase
        .from('brands')
        .select('id, name')
        .eq('id', singleBrandId)
        .maybeSingle();
      targets = brand ? [{ brand_id: brand.id, brand_name: brand.name, event_count: 0 }] : [];
    } else {
      const { data: queue, error } = await supabase
        .rpc('get_activation_queue', { batch_size: batchSize });
      if (error) throw error;
      targets = queue || [];

      if (tierFilter === 'near_ready') {
        targets = targets.filter((b: any) => b.event_count >= 4);
      } else if (tierFilter === 'fast_follow') {
        targets = targets.filter((b: any) => b.event_count >= 2 && b.event_count < 4);
      }
    }

    if (targets.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, note: "No brands to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[bulk-regulatory] Processing ${targets.length} brands`);

    const allResults: Array<{
      brand_id: string;
      brand_name: string;
      total_inserted: number;
      by_source: PipelineResult[];
    }> = [];

    for (const brand of targets) {
      const sourceResults = await runAllAdapters(supabase, adapters, brand.brand_id);
      const totalInserted = sourceResults.reduce((s, r) => s + r.inserted, 0);
      allResults.push({
        brand_id: brand.brand_id,
        brand_name: brand.brand_name,
        total_inserted: totalInserted,
        by_source: sourceResults,
      });
      await new Promise(r => setTimeout(r, 500));
    }

    // Auto-promote
    const { data: promoted } = await supabase.rpc('promote_eligible_brands');

    const totalInserted = allResults.reduce((s, r) => s + r.total_inserted, 0);

    // Source summary
    const sourceSummary: Record<string, { scanned: number; inserted: number; skipped: number }> = {};
    for (const br of allResults) {
      for (const sr of br.by_source) {
        if (!sourceSummary[sr.source]) sourceSummary[sr.source] = { scanned: 0, inserted: 0, skipped: 0 };
        sourceSummary[sr.source].scanned += sr.scanned;
        sourceSummary[sr.source].inserted += sr.inserted;
        sourceSummary[sr.source].skipped += sr.skipped;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode: 'targeted',
        brands_processed: targets.length,
        brands_with_new_events: allResults.filter(r => r.total_inserted > 0).length,
        total_events_inserted: totalInserted,
        brands_promoted: promoted || 0,
        source_summary: sourceSummary,
        results: allResults.map(r => ({
          brand: r.brand_name,
          inserted: r.total_inserted,
          sources: r.by_source.filter(s => s.inserted > 0).map(s => `${s.source}:${s.inserted}`),
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[bulk-regulatory] Fatal:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
