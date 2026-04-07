/**
 * Backfill existing events with brand_relevance_score and is_marketing_noise.
 * Runs once to retroactively apply the automated filtering system.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { applyEventFilters } from "../_shared/eventFilters.ts";

const BATCH_SIZE = 200;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let processed = 0;
  let updated = 0;
  let madeIneligible = 0;
  let marketingNoise = 0;
  let parentOnly = 0;
  let page = 0;

  // Fetch all brands with their parent companies for lookup
  const { data: allBrands } = await supabase
    .from("brands")
    .select("id, name, aliases, parent_company");
  
  const brandMap = new Map<string, { name: string; aliases: string[]; parent_company: string | null }>();
  for (const b of allBrands || []) {
    brandMap.set(b.id, {
      name: b.name,
      aliases: b.aliases || [],
      parent_company: b.parent_company || null,
    });
  }

  console.log(`[BackfillFilters] Loaded ${brandMap.size} brands`);

  while (true) {
    // Fetch events that haven't been scored yet (brand_relevance_score = 0 is default)
    const { data: events, error } = await supabase
      .from("brand_events")
      .select("event_id, brand_id, title, description, score_eligible, brand_relevance_score")
      .eq("brand_relevance_score", 0)
      .order("created_at", { ascending: false })
      .range(page * BATCH_SIZE, (page + 1) * BATCH_SIZE - 1);

    if (error) {
      console.error("[BackfillFilters] Query error:", error);
      break;
    }

    if (!events || events.length === 0) break;

    for (const event of events) {
      const brand = brandMap.get(event.brand_id);
      if (!brand) {
        processed++;
        continue;
      }

      const result = applyEventFilters(
        event.title || "",
        event.description || "",
        brand.name,
        brand.aliases,
        brand.parent_company,
        event.score_eligible ?? false
      );

      // Only update if something changed
      const needsUpdate =
        result.brand_relevance_score !== (event.brand_relevance_score ?? 0) ||
        result.is_marketing_noise ||
        (result.score_eligible !== event.score_eligible);

      if (needsUpdate) {
        const updateData: Record<string, any> = {
          brand_relevance_score: result.brand_relevance_score,
          is_marketing_noise: result.is_marketing_noise,
        };

        // Only downgrade eligibility, never upgrade
        if (!result.score_eligible && event.score_eligible) {
          updateData.score_eligible = false;
          updateData.score_excluded_reason = result.filter_reason || null;
          madeIneligible++;
        }

        if (result.is_marketing_noise) marketingNoise++;
        if (result.brand_relevance_score === 1) parentOnly++;

        await supabase
          .from("brand_events")
          .update(updateData)
          .eq("event_id", event.event_id);

        updated++;
      }

      processed++;
    }

    console.log(`[BackfillFilters] Batch ${page}: processed=${processed}, updated=${updated}`);

    if (events.length < BATCH_SIZE) break;
    page++;
  }

  const summary = {
    ok: true,
    processed,
    updated,
    madeIneligible,
    marketingNoise,
    parentOnly,
  };

  console.log("[BackfillFilters] Complete:", JSON.stringify(summary));

  return new Response(JSON.stringify(summary), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
