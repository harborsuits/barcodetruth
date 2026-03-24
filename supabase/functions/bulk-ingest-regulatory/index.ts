/**
 * Bulk Regulatory Ingestion Orchestrator
 * 
 * Runs ALL regulatory source adapters against the activation queue.
 * After ingestion, auto-promotes eligible brands.
 * 
 * POST body (all optional):
 *   batch_size: number (default 30, max 100)
 *   tier: 'near_ready' | 'fast_follow' | 'all' (default 'all')
 *   sources: string[] (adapter IDs to run, default all)
 *   brand_id: string (run for a single brand instead of queue)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runAllAdapters, type PipelineResult } from "../_shared/regulatoryPipeline.ts";
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

    // Parse options
    let batchSize = 30;
    let tierFilter = 'all';
    let sourceIds: string[] | undefined;
    let singleBrandId: string | undefined;

    try {
      const body = await req.json();
      if (body.batch_size) batchSize = Math.min(body.batch_size, 100);
      if (body.tier) tierFilter = body.tier;
      if (body.sources) sourceIds = body.sources;
      if (body.brand_id) singleBrandId = body.brand_id;
    } catch { /* no body */ }

    const adapters = getAdapters(sourceIds);
    console.log(`[bulk-regulatory] Sources: ${adapters.map(a => a.id).join(', ')}`);

    // Get target brands
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

      // Filter by tier
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

    console.log(`[bulk-regulatory] Processing ${targets.length} brands with ${adapters.length} sources`);

    const allResults: Array<{
      brand_id: string;
      brand_name: string;
      total_inserted: number;
      by_source: PipelineResult[];
    }> = [];

    for (const brand of targets) {
      console.log(`[bulk-regulatory] ── ${brand.brand_name} (events: ${brand.event_count}) ──`);
      
      const sourceResults = await runAllAdapters(supabase, adapters, brand.brand_id);
      const totalInserted = sourceResults.reduce((s, r) => s + r.inserted, 0);
      
      allResults.push({
        brand_id: brand.brand_id,
        brand_name: brand.brand_name,
        total_inserted: totalInserted,
        by_source: sourceResults,
      });

      // Brief pause between brands
      await new Promise(r => setTimeout(r, 500));
    }

    // Auto-promote after all ingestion
    console.log('[bulk-regulatory] Running promote_eligible_brands()...');
    const { data: promoted, error: promoteErr } = await supabase.rpc('promote_eligible_brands');
    if (promoteErr) {
      console.error('[bulk-regulatory] Promotion error:', promoteErr);
    }

    const totalInserted = allResults.reduce((s, r) => s + r.total_inserted, 0);
    const brandsWithNewEvents = allResults.filter(r => r.total_inserted > 0).length;

    // Summary by source
    const sourceSummary: Record<string, { scanned: number; inserted: number; skipped: number }> = {};
    for (const br of allResults) {
      for (const sr of br.by_source) {
        if (!sourceSummary[sr.source]) sourceSummary[sr.source] = { scanned: 0, inserted: 0, skipped: 0 };
        sourceSummary[sr.source].scanned += sr.scanned;
        sourceSummary[sr.source].inserted += sr.inserted;
        sourceSummary[sr.source].skipped += sr.skipped;
      }
    }

    console.log(`[bulk-regulatory] Complete: ${totalInserted} events from ${targets.length} brands, ${promoted || 0} promoted`);

    return new Response(
      JSON.stringify({
        success: true,
        brands_processed: targets.length,
        brands_with_new_events: brandsWithNewEvents,
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
