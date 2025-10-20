import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  console.log('[batch-resolve-logos] Starting batch logo resolution');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get brands without logos (or old clearbit logos that might need refresh)
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, name, website, wikidata_qid')
      .is('logo_url', null)
      .eq('is_active', true)
      .order('name')
      .limit(50); // Process 50 at a time to avoid timeouts

    if (brandsError) {
      throw brandsError;
    }

    if (!brands || brands.length === 0) {
      console.log('[batch-resolve-logos] No brands need logo resolution');
      return new Response(
        JSON.stringify({ ok: true, processed: 0, message: 'No brands need logos' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[batch-resolve-logos] Found ${brands.length} brands without logos`);

    const results = {
      processed: 0,
      resolved: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process brands sequentially to avoid rate limits
    for (const brand of brands) {
      results.processed++;
      
      try {
        // Call the resolve-brand-logo function
        const { data, error } = await supabase.functions.invoke('resolve-brand-logo', {
          body: { brand_id: brand.id },
        });

        if (error) {
          console.error(`[batch-resolve-logos] Error for ${brand.name}:`, error);
          results.failed++;
          results.errors.push(`${brand.name}: ${error.message}`);
        } else if (data?.ok) {
          console.log(`[batch-resolve-logos] ✓ Resolved logo for ${brand.name} from ${data.attribution}`);
          results.resolved++;
        } else {
          console.log(`[batch-resolve-logos] ✗ No logo found for ${brand.name}`);
          results.failed++;
        }

        // Small delay to avoid hammering external APIs
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        console.error(`[batch-resolve-logos] Exception for ${brand.name}:`, err);
        results.failed++;
        results.errors.push(`${brand.name}: ${err instanceof Error ? err.message : 'unknown error'}`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[batch-resolve-logos] Complete - processed: ${results.processed}, resolved: ${results.resolved}, failed: ${results.failed}, duration: ${duration}ms`);

    return new Response(
      JSON.stringify({
        ok: true,
        ...results,
        duration_ms: duration,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[batch-resolve-logos] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        ok: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - startTime,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
