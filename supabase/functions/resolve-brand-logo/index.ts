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

  try {
    const { brand_id } = await req.json();
    
    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: 'brand_id required' }),
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
        const wikidataResp = await fetch(
          `https://www.wikidata.org/wiki/Special:EntityData/${brand.wikidata_qid}.json`
        );
        
        if (wikidataResp.ok) {
          const wikidataJson = await wikidataResp.json();
          const entity = wikidataJson.entities[brand.wikidata_qid];
          const logoProperty = entity?.claims?.P154; // P154 is the logo image property
          
          if (logoProperty && logoProperty.length > 0) {
            const filename = logoProperty[0].mainsnak?.datavalue?.value;
            if (filename) {
              // Wikimedia Commons URL pattern
              const encodedFilename = encodeURIComponent(filename.replace(/ /g, '_'));
              logoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedFilename}`;
              attribution = 'wikimedia_commons';
            }
          }
        }
      } catch (e) {
        console.log('Wikimedia Commons lookup failed:', e);
      }
    }

    // Fallback to Clearbit if no Commons logo found
    if (!logoUrl && brand.website) {
      try {
        const domain = new URL(brand.website).hostname.replace(/^www\./, '');
        const clearbitUrl = `https://logo.clearbit.com/${domain}`;
        
        // Check if Clearbit has a logo
        const checkResp = await fetch(clearbitUrl, { method: 'HEAD' });
        if (checkResp.ok) {
          logoUrl = clearbitUrl;
          attribution = 'clearbit';
        }
      } catch (e) {
        console.log('Clearbit lookup failed:', e);
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
        return new Response(
          JSON.stringify({ error: 'Failed to update brand' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ ok: true, logo_url: logoUrl, attribution }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: false, reason: 'no_logo_found' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('resolve-brand-logo error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});