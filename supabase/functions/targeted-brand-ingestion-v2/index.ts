/**
 * Targeted Brand Ingestion V2
 * 
 * Autonomous pipeline that replaces manual surgical ingestion:
 * 1. Pulls from FDA, OSHA, and news sources
 * 2. Post-ingestion validation: applies entity attribution, marketing noise, dedup filters
 * 3. Cleans up any junk that slipped through source functions
 * 4. Recomputes brand score
 * 5. Returns detailed audit report with events added/rejected/reasons
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { compareTwoStrings } from "https://esm.sh/string-similarity@4.0.4";
import { applyEventFilters } from "../_shared/eventFilters.ts";
import { passesFinancialBlocklist } from "../_shared/ingestionGate.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IngestionReport {
  brand_id: string;
  brand_name: string;
  sources: {
    fda: SourceResult;
    osha: SourceResult;
    news: SourceResult;
  };
  post_validation: {
    events_before: number;
    events_audited: number;
    demoted_entity_mismatch: number;
    demoted_marketing_noise: number;
    demoted_financial_noise: number;
    demoted_zero_impact: number;
    demoted_parent_only: number;
    duplicates_suppressed: number;
    events_after_eligible: number;
    reasons: string[];
  };
  score: {
    before: number | null;
    after: number | null;
    eligible_events: number;
    delta: number;
  };
  success: boolean;
}

interface SourceResult {
  success: boolean;
  inserted: number;
  skipped: number;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { brand_id, sources: requestedSources } = body;

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: 'brand_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load brand info + aliases
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, parent_company')
      .eq('id', brand_id)
      .maybeSingle();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: aliases } = await supabase
      .from('brand_aliases')
      .select('external_name')
      .eq('canonical_brand_id', brand_id);
    
    const brandAliases = (aliases || []).map(a => a.external_name).filter(Boolean);

    console.log(`[v2-ingestion] Starting for ${brand.name} (${brand_id}), aliases: [${brandAliases.join(', ')}]`);

    // Get score before ingestion
    const { data: scoreBefore } = await supabase
      .from('brand_scores')
      .select('score')
      .eq('brand_id', brand_id)
      .maybeSingle();

    const scoreBeforeVal = scoreBefore?.score ?? null;

    // Count eligible events before
    const { count: eligibleBefore } = await supabase
      .from('brand_events')
      .select('event_id', { count: 'exact', head: true })
      .eq('brand_id', brand_id)
      .eq('score_eligible', true);

    // ──────────────────────────────────────────────
    // PHASE 1: Call source ingestion functions
    // ──────────────────────────────────────────────
    const fxBase = `${supabaseUrl}/functions/v1`;
    const authHeader = { 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' };
    const enabledSources = requestedSources || ['fda', 'osha', 'news'];

    const sourceResults: Record<string, SourceResult> = {
      fda: { success: false, inserted: 0, skipped: 0 },
      osha: { success: false, inserted: 0, skipped: 0 },
      news: { success: false, inserted: 0, skipped: 0 },
    };

    // FDA
    if (enabledSources.includes('fda')) {
      try {
        const resp = await fetch(
          `${fxBase}/ingest-fda-recalls?brand_id=${brand_id}`,
          { method: 'POST', headers: authHeader }
        );
        if (resp.ok) {
          const data = await resp.json();
          sourceResults.fda = { success: true, inserted: data.inserted || 0, skipped: data.skipped || 0 };
        } else {
          const text = await resp.text();
          sourceResults.fda.error = `${resp.status}: ${text.substring(0, 200)}`;
        }
      } catch (e) {
        sourceResults.fda.error = e instanceof Error ? e.message : String(e);
      }
      console.log(`[v2-ingestion] FDA: +${sourceResults.fda.inserted} inserted, ${sourceResults.fda.skipped} skipped`);
    }

    // OSHA
    if (enabledSources.includes('osha')) {
      try {
        const resp = await fetch(
          `${fxBase}/fetch-osha-events?brand_id=${brand_id}`,
          { method: 'POST', headers: authHeader }
        );
        if (resp.ok) {
          const data = await resp.json();
          sourceResults.osha = { success: true, inserted: data.inserted || 0, skipped: data.skipped || 0 };
        } else {
          const text = await resp.text();
          sourceResults.osha.error = `${resp.status}: ${text.substring(0, 200)}`;
        }
      } catch (e) {
        sourceResults.osha.error = e instanceof Error ? e.message : String(e);
      }
      console.log(`[v2-ingestion] OSHA: +${sourceResults.osha.inserted} inserted, ${sourceResults.osha.skipped} skipped`);
    }

    // News (unified orchestrator)
    if (enabledSources.includes('news')) {
      try {
        const resp = await fetch(
          `${fxBase}/unified-news-orchestrator?brand_id=${brand_id}&categories=labor,environment&max_sources=5`,
          { method: 'GET', headers: authHeader }
        );
        if (resp.ok) {
          const data = await resp.json();
          sourceResults.news = {
            success: true,
            inserted: data.totalInserted || 0,
            skipped: data.totalSkipped || 0,
          };
        } else {
          const text = await resp.text();
          sourceResults.news.error = `${resp.status}: ${text.substring(0, 200)}`;
        }
      } catch (e) {
        sourceResults.news.error = e instanceof Error ? e.message : String(e);
      }
      console.log(`[v2-ingestion] News: +${sourceResults.news.inserted} inserted, ${sourceResults.news.skipped} skipped`);
    }

    // ──────────────────────────────────────────────
    // PHASE 2: Post-ingestion quality validation
    // ──────────────────────────────────────────────
    // Fetch ALL events for this brand that are currently score_eligible
    const { data: allEvents, error: eventsError } = await supabase
      .from('brand_events')
      .select('event_id, title, description, category, score_eligible, brand_relevance_score, is_marketing_noise, impact_labor, impact_environment, impact_politics, impact_social, source_tier, event_date')
      .eq('brand_id', brand_id)
      .order('event_date', { ascending: false })
      .limit(500);

    if (eventsError) {
      console.error('[v2-ingestion] Error fetching events:', eventsError);
    }

    const events = allEvents || [];
    const validation = {
      events_before: eligibleBefore || 0,
      events_audited: events.length,
      demoted_entity_mismatch: 0,
      demoted_marketing_noise: 0,
      demoted_financial_noise: 0,
      demoted_zero_impact: 0,
      demoted_parent_only: 0,
      duplicates_suppressed: 0,
      events_after_eligible: 0,
      reasons: [] as string[],
    };

    const demotionBatch: string[] = []; // event_ids to mark score_eligible = false
    const demotionReasons: Record<string, string> = {};

    for (const ev of events) {
      if (!ev.score_eligible) continue; // Already ineligible, skip

      const title = ev.title || '';
      const desc = ev.description || '';

      // Check 1: Brand attribution (relevance score)
      const filterResult = applyEventFilters(
        title, desc, brand.name, brandAliases, brand.parent_company, true
      );

      if (!filterResult.score_eligible && filterResult.filter_reason) {
        if (filterResult.filter_reason.includes('Parent-only')) {
          validation.demoted_parent_only++;
          demotionBatch.push(ev.event_id);
          demotionReasons[ev.event_id] = filterResult.filter_reason;
          continue;
        }
        if (filterResult.filter_reason.includes('No brand attribution')) {
          validation.demoted_entity_mismatch++;
          demotionBatch.push(ev.event_id);
          demotionReasons[ev.event_id] = filterResult.filter_reason;
          continue;
        }
      }

      // Check 2: Marketing noise
      if (filterResult.is_marketing_noise) {
        validation.demoted_marketing_noise++;
        demotionBatch.push(ev.event_id);
        demotionReasons[ev.event_id] = 'Marketing/PR noise';
        continue;
      }

      // Check 3: Financial noise
      const financialGate = passesFinancialBlocklist(title, desc);
      if (!financialGate.pass) {
        validation.demoted_financial_noise++;
        demotionBatch.push(ev.event_id);
        demotionReasons[ev.event_id] = financialGate.reason || 'Financial noise';
        continue;
      }

      // Check 4: Zero-impact events (all dimensions = 0)
      const totalImpact = Math.abs(ev.impact_labor || 0) + Math.abs(ev.impact_environment || 0) +
                          Math.abs(ev.impact_politics || 0) + Math.abs(ev.impact_social || 0);
      if (totalImpact === 0) {
        validation.demoted_zero_impact++;
        demotionBatch.push(ev.event_id);
        demotionReasons[ev.event_id] = 'All impact dimensions are zero';
        continue;
      }
    }

    // Check 5: Title-similarity deduplication among eligible events
    const eligibleEvents = events.filter(e => e.score_eligible && !demotionBatch.includes(e.event_id));
    const seenTitles: Array<{ event_id: string; title: string; date: string }> = [];
    
    for (const ev of eligibleEvents) {
      const title = (ev.title || '').toLowerCase();
      if (!title || title.length < 10) continue;

      const isDuplicate = seenTitles.some(seen => {
        const similarity = compareTwoStrings(title, seen.title.toLowerCase());
        if (similarity > 0.75) {
          // Within 14 days = likely duplicate
          const daysDiff = Math.abs(
            new Date(ev.event_date || '').getTime() - new Date(seen.date || '').getTime()
          ) / (1000 * 60 * 60 * 24);
          return daysDiff < 14;
        }
        return false;
      });

      if (isDuplicate) {
        validation.duplicates_suppressed++;
        demotionBatch.push(ev.event_id);
        demotionReasons[ev.event_id] = 'Duplicate (>75% title similarity within 14 days)';
      } else {
        seenTitles.push({ event_id: ev.event_id, title: ev.title || '', date: ev.event_date || '' });
      }
    }

    // Execute demotions in batches
    if (demotionBatch.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < demotionBatch.length; i += BATCH_SIZE) {
        const batch = demotionBatch.slice(i, i + BATCH_SIZE);
        const { error: updateError } = await supabase
          .from('brand_events')
          .update({ score_eligible: false, noise_reason: 'v2-post-validation' })
          .in('event_id', batch);
        
        if (updateError) {
          console.error(`[v2-ingestion] Demotion batch error:`, updateError);
        }
      }

      // Log reasons
      for (const [eid, reason] of Object.entries(demotionReasons)) {
        validation.reasons.push(`${eid.substring(0, 8)}: ${reason}`);
      }
      console.log(`[v2-ingestion] Demoted ${demotionBatch.length} events`);
    }

    // Count remaining eligible events
    const { count: eligibleAfter } = await supabase
      .from('brand_events')
      .select('event_id', { count: 'exact', head: true })
      .eq('brand_id', brand_id)
      .eq('score_eligible', true);

    validation.events_after_eligible = eligibleAfter || 0;

    // ──────────────────────────────────────────────
    // PHASE 3: Recompute score
    // ──────────────────────────────────────────────
    try {
      const resp = await fetch(
        `${fxBase}/recompute-brand-scores`,
        { method: 'POST', headers: authHeader, body: JSON.stringify({ brand_id }) }
      );
      if (!resp.ok) {
        const text = await resp.text();
        console.error('[v2-ingestion] Score recompute error:', text.substring(0, 200));
      } else {
        await resp.text(); // consume body
        console.log('[v2-ingestion] Score recomputed');
      }
    } catch (e) {
      console.error('[v2-ingestion] Score recompute failed:', e);
    }

    // Get score after
    const { data: scoreAfter } = await supabase
      .from('brand_scores')
      .select('score')
      .eq('brand_id', brand_id)
      .maybeSingle();

    const scoreAfterVal = scoreAfter?.score ?? null;

    // ──────────────────────────────────────────────
    // Build report
    // ──────────────────────────────────────────────
    const report: IngestionReport = {
      brand_id,
      brand_name: brand.name,
      sources: {
        fda: sourceResults.fda,
        osha: sourceResults.osha,
        news: sourceResults.news,
      },
      post_validation: validation,
      score: {
        before: scoreBeforeVal,
        after: scoreAfterVal,
        eligible_events: validation.events_after_eligible,
        delta: (scoreAfterVal ?? 0) - (scoreBeforeVal ?? 0),
      },
      success: true,
    };

    console.log(`[v2-ingestion] Complete for ${brand.name}:`);
    console.log(`  Sources: FDA +${sourceResults.fda.inserted}, OSHA +${sourceResults.osha.inserted}, News +${sourceResults.news.inserted}`);
    console.log(`  Validation: ${demotionBatch.length} demoted (${validation.demoted_entity_mismatch} entity, ${validation.demoted_marketing_noise} marketing, ${validation.demoted_financial_noise} financial, ${validation.demoted_zero_impact} zero-impact, ${validation.demoted_parent_only} parent-only, ${validation.duplicates_suppressed} dupes)`);
    console.log(`  Score: ${scoreBeforeVal} → ${scoreAfterVal} (${validation.events_after_eligible} eligible events)`);

    return new Response(
      JSON.stringify(report),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[v2-ingestion] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error), success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
