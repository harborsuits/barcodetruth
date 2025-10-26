/**
 * run-system-wide-heal
 * 
 * PROACTIVE system-wide fix for ALL brands.
 * This is NOT a reactive health check that waits for page visits.
 * This processes EVERY brand in the database to ensure uniformity.
 * 
 * Run this ONCE to achieve complete system uniformity.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[System Heal] ========================================');
    console.log('[System Heal] Starting COMPLETE database heal');
    console.log('[System Heal] ========================================');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get ALL brands with wikidata_qid (not just incomplete ones)
    const { data: allBrands, error: brandsError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid')
      .not('wikidata_qid', 'is', null)
      .order('name');

    if (brandsError) throw brandsError;
    if (!allBrands || allBrands.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No brands to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[System Heal] Found ${allBrands.length} brands to process`);
    console.log('[System Heal] ========================================');

    let processed = 0;
    let seeded = 0;
    let enriched = 0;
    let skipped = 0;
    let errors = 0;

    const results: any[] = [];

    for (const brand of allBrands) {
      try {
        console.log(`[System Heal] [${processed + 1}/${allBrands.length}] Processing: ${brand.name}`);

        // Check if brand needs seeding (no company link)
        const { data: ownership } = await supabase
          .from('company_ownership')
          .select('id')
          .eq('child_brand_id', brand.id)
          .limit(1);

        const needsSeeding = !ownership || ownership.length === 0;

        if (needsSeeding) {
          console.log(`  → Seeding base data...`);

          // Seed base data (company + ownership + shareholders)
          const seedResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/seed-brand-base-data`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                brand_id: brand.id,
                wikidata_qid: brand.wikidata_qid,
                brand_name: brand.name
              }),
            }
          );

          if (!seedResponse.ok) {
            const errorText = await seedResponse.text();
            console.error(`  ✗ Seed failed: ${errorText}`);
            errors++;
            results.push({ brand: brand.name, status: 'seed_failed', error: errorText });
            processed++;
            continue;
          }

          const seedData = await seedResponse.json();
          console.log(`  ✓ Seeded (company_id: ${seedData.company_id})`);
          seeded++;

          // Wait 2 seconds for seed to complete
          await new Promise(r => setTimeout(r, 2000));

          // Now enrich key people
          console.log(`  → Enriching key people...`);

          const enrichResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-brand-wiki`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                brand_id: brand.id,
                wikidata_qid: brand.wikidata_qid,
                mode: 'full'
              }),
            }
          );

          if (!enrichResponse.ok) {
            const errorText = await enrichResponse.text();
            console.error(`  ✗ Enrich failed: ${errorText}`);
            results.push({ brand: brand.name, status: 'enrich_failed', error: errorText });
          } else {
            console.log(`  ✓ Enriched`);
            enriched++;
            results.push({ brand: brand.name, status: 'complete' });
          }

        } else {
          console.log(`  ✓ Already has base data, skipping`);
          skipped++;
          results.push({ brand: brand.name, status: 'skipped' });
        }

        processed++;

        // Rate limit (500ms between brands)
        await new Promise(r => setTimeout(r, 500));

        // Log progress every 10 brands
        if (processed % 10 === 0) {
          console.log('[System Heal] ----------------------------------------');
          console.log(`[System Heal] Progress: ${processed}/${allBrands.length}`);
          console.log(`[System Heal] Seeded: ${seeded} | Enriched: ${enriched} | Skipped: ${skipped} | Errors: ${errors}`);
          console.log('[System Heal] ----------------------------------------');
        }

      } catch (error: any) {
        console.error(`[System Heal] ✗ Error processing ${brand.name}:`, error.message);
        errors++;
        results.push({ brand: brand.name, status: 'error', error: error.message });
        processed++;
      }
    }

    console.log('[System Heal] ========================================');
    console.log('[System Heal] ✅ COMPLETE');
    console.log(`[System Heal] Total: ${processed} brands`);
    console.log(`[System Heal] Seeded: ${seeded}`);
    console.log(`[System Heal] Enriched: ${enriched}`);
    console.log(`[System Heal] Skipped: ${skipped}`);
    console.log(`[System Heal] Errors: ${errors}`);
    console.log('[System Heal] ========================================');

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: processed,
          seeded,
          enriched,
          skipped,
          errors
        },
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[System Heal] FATAL ERROR:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
