import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { requireInternal } from '../_shared/internal.ts';
import { 
  normalizeDomain, 
  tryFavicon, 
  tryDDG, 
  tryWikimedia, 
  tryClearbit,
  uploadLogoToStorage,
  type LogoResult 
} from '../_shared/logoResolvers.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-token, x-cron',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // SECURITY: Only allow internal/cron calls
  const authError = requireInternal(req, 'batch-resolve-logos');
  if (authError) return authError;

  const startTime = Date.now();
  console.log('[batch-resolve-logos] Starting batch logo resolution');

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get brands needing logos (limited to 50 per run)
    const { data: brands, error: brandsError } = await supabase
      .from('v_brands_needing_logos')
      .select('id, name, website, wikidata_qid')
      .limit(50);

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

    console.log(`[batch-resolve-logos] Processing ${brands.length} brands`);

    const results = {
      processed: 0,
      resolved: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[],
    };

    // Process brands sequentially to be polite to external services
    for (const brand of brands) {
      results.processed++;
      const domain = normalizeDomain(brand.website);
      
      if (!domain) {
        console.log(`[batch-resolve-logos] ✗ ${brand.name}: No valid domain`);
        // Still update last_checked so we don't retry constantly
        await supabase.from('brands').update({
          logo_last_checked: new Date().toISOString()
        }).eq('id', brand.id);
        results.skipped++;
        continue;
      }

      try {
        let logoResult: LogoResult | null = null;

        // Try resolution sources in order of preference (free first)
        logoResult = await tryWikimedia(brand.wikidata_qid);
        if (!logoResult) logoResult = await tryFavicon(domain);
        if (!logoResult) logoResult = await tryDDG(domain);
        if (!logoResult) logoResult = await tryClearbit(domain);

        if (logoResult) {
          // Upload to storage
          const upload = await uploadLogoToStorage(
            supabase, 
            brand.id, 
            logoResult.url, 
            logoResult.etag
          );

          if (upload?.publicUrl) {
            // Update brand with storage URL
            const { error: updateError } = await supabase.from('brands').update({
              logo_url: upload.publicUrl,
              logo_source: logoResult.source,
              logo_last_checked: new Date().toISOString(),
              logo_etag: logoResult.etag ?? null,
            }).eq('id', brand.id);

            if (updateError) {
              console.error(`[batch-resolve-logos] DB update failed for ${brand.name}:`, updateError);
              results.failed++;
            } else {
              console.log(`[batch-resolve-logos] ✓ ${brand.name}: ${logoResult.source}`);
              results.resolved++;
              results.details.push({
                brand: brand.name,
                source: logoResult.source,
                ok: true,
              });
            }
          } else {
            // Found logo but upload failed
            console.log(`[batch-resolve-logos] ✗ ${brand.name}: Upload failed`);
            await supabase.from('brands').update({
              logo_last_checked: new Date().toISOString()
            }).eq('id', brand.id);
            results.failed++;
          }
        } else {
          // No logo found from any source
          console.log(`[batch-resolve-logos] ✗ ${brand.name}: No logo found`);
          await supabase.from('brands').update({
            logo_last_checked: new Date().toISOString()
          }).eq('id', brand.id);
          results.failed++;
        }

        // Small delay to avoid hammering external services
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (err) {
        console.error(`[batch-resolve-logos] Exception for ${brand.name}:`, err);
        // Update last_checked even on error
        await supabase.from('brands').update({
          logo_last_checked: new Date().toISOString()
        }).eq('id', brand.id);
        results.failed++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[batch-resolve-logos] Complete - processed: ${results.processed}, ` +
      `resolved: ${results.resolved}, failed: ${results.failed}, ` +
      `skipped: ${results.skipped}, duration: ${duration}ms`
    );

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
