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
  
  try {
    const { brand_id } = await req.json();
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!brand_id || !uuidRegex.test(brand_id)) {
      console.log(JSON.stringify({ 
        action: 'resolve-brand-logo', 
        ok: false, 
        reason: 'invalid_brand_id',
        duration_ms: Date.now() - startTime 
      }));
      return new Response(
        JSON.stringify({ error: 'valid brand_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch brand
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid, website, logo_attribution')
      .eq('id', brand_id)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Don't overwrite manual logos
    if (brand.logo_attribution === 'manual') {
      console.log(JSON.stringify({ 
        action: 'resolve-brand-logo', 
        brand_id, 
        ok: false, 
        reason: 'manual_override',
        duration_ms: Date.now() - startTime 
      }));
      return new Response(
        JSON.stringify({ ok: false, reason: 'manual_override' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let logoUrl = null;
    let attribution = null;

    // Try Wikimedia Commons first
    if (brand.wikidata_qid) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        
        const wikidataResp = await fetch(
          `https://www.wikidata.org/wiki/Special:EntityData/${brand.wikidata_qid}.json`,
          { signal: controller.signal }
        );
        clearTimeout(timeout);
        
        if (wikidataResp.ok) {
          const wikidataJson = await wikidataResp.json();
          const entity = wikidataJson.entities[brand.wikidata_qid];
          const logoProperty = entity?.claims?.P154; // P154 is the logo image property
          
          if (logoProperty && logoProperty.length > 0) {
            const filename = logoProperty[0].mainsnak?.datavalue?.value;
            if (filename) {
              // Wikimedia Commons URL pattern
              const encodedFilename = encodeURIComponent(filename.replace(/ /g, '_'));
              const commonsUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedFilename}`;
              
              // Verify it's actually an image
              try {
                const headController = new AbortController();
                const headTimeout = setTimeout(() => headController.abort(), 5000);
                const headResp = await fetch(commonsUrl, { 
                  method: 'HEAD',
                  signal: headController.signal 
                });
                clearTimeout(headTimeout);
                
                const contentType = headResp.headers.get('content-type') || '';
                if (headResp.ok && contentType.startsWith('image/')) {
                  logoUrl = commonsUrl;
                  attribution = 'wikimedia_commons';
                }
              } catch (e) {
                console.log('Commons image verification failed:', e);
              }
            }
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          console.log('Wikimedia Commons lookup timed out');
        } else {
          console.log('Wikimedia Commons lookup failed:', e);
        }
      }
    }

    // Fallback to Clearbit if no Commons logo found
    if (!logoUrl && brand.website) {
      try {
        // Normalize website URL (add https:// if missing)
        let websiteUrl = brand.website;
        if (!websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
          websiteUrl = 'https://' + websiteUrl;
        }
        
        const domain = new URL(websiteUrl).hostname.replace(/^www\./, '');
        const clearbitUrl = `https://logo.clearbit.com/${domain}`;
        
        // Check if Clearbit has a logo with timeout
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        
        const checkResp = await fetch(clearbitUrl, { 
          method: 'HEAD',
          signal: controller.signal 
        });
        clearTimeout(timeout);
        
        if (checkResp.ok) {
          logoUrl = clearbitUrl;
          attribution = 'clearbit';
        } else if (checkResp.status === 403) {
          // Clearbit sometimes blocks HEAD, try GET with Range
          const rangeController = new AbortController();
          const rangeTimeout = setTimeout(() => rangeController.abort(), 5000);
          
          const rangeResp = await fetch(clearbitUrl, {
            headers: { 'Range': 'bytes=0-0' },
            signal: rangeController.signal
          });
          clearTimeout(rangeTimeout);
          
          if (rangeResp.ok || rangeResp.status === 206) {
            logoUrl = clearbitUrl;
            attribution = 'clearbit';
          }
        }
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          console.log('Clearbit lookup timed out');
        } else {
          console.log('Clearbit lookup failed:', e);
        }
      }
    }

    // Update brand with logo
    if (logoUrl) {
      const { error: updateError } = await supabase
        .from('brands')
        .update({
          logo_url: logoUrl,
          logo_attribution: attribution
        })
        .eq('id', brand_id);

      if (updateError) {
        console.error('Failed to update brand logo:', updateError);
        console.log(JSON.stringify({ 
          action: 'resolve-brand-logo', 
          brand_id, 
          ok: false, 
          reason: 'db_update_failed',
          duration_ms: Date.now() - startTime 
        }));
        return new Response(
          JSON.stringify({ error: 'Failed to update brand' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(JSON.stringify({ 
        action: 'resolve-brand-logo', 
        brand_id, 
        ok: true,
        source: attribution,
        duration_ms: Date.now() - startTime 
      }));

      return new Response(
        JSON.stringify({ ok: true, logo_url: logoUrl, attribution }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(JSON.stringify({ 
      action: 'resolve-brand-logo', 
      brand_id, 
      ok: false, 
      reason: 'no_logo_found',
      duration_ms: Date.now() - startTime 
    }));

    return new Response(
      JSON.stringify({ ok: false, reason: 'no_logo_found' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('resolve-brand-logo error:', error);
    console.log(JSON.stringify({ 
      action: 'resolve-brand-logo', 
      ok: false, 
      reason: 'unhandled_error',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: Date.now() - startTime 
    }));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});