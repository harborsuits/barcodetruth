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
        action: 'fetch-brand-summary', 
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

    // Fetch brand with wikidata_qid
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid, description_source')
      .eq('id', brand_id)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Don't overwrite manual descriptions
    if (brand.description_source === 'manual') {
      console.log(JSON.stringify({ 
        action: 'fetch-brand-summary', 
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

    if (!brand.wikidata_qid) {
      console.log(JSON.stringify({ 
        action: 'fetch-brand-summary', 
        brand_id, 
        ok: false, 
        reason: 'no_wikidata',
        duration_ms: Date.now() - startTime 
      }));
      return new Response(
        JSON.stringify({ ok: false, reason: 'no_wikidata' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Wikipedia page title from Wikidata with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    try {
      const wikidataResp = await fetch(
        `https://www.wikidata.org/wiki/Special:EntityData/${brand.wikidata_qid}.json`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      
      if (!wikidataResp.ok) {
        console.log(JSON.stringify({ 
          action: 'fetch-brand-summary', 
          brand_id, 
          ok: false, 
          reason: 'wikidata_fetch_failed',
          status: wikidataResp.status,
          duration_ms: Date.now() - startTime 
        }));
        return new Response(
          JSON.stringify({ ok: false, reason: 'wikidata_fetch_failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const wikidataJson = await wikidataResp.json();
      const entity = wikidataJson.entities[brand.wikidata_qid];
      const enWikiTitle = entity?.sitelinks?.enwiki?.title;

      if (!enWikiTitle) {
        console.log(JSON.stringify({ 
          action: 'fetch-brand-summary', 
          brand_id, 
          ok: false, 
          reason: 'no_wikipedia_page',
          duration_ms: Date.now() - startTime 
        }));
        return new Response(
          JSON.stringify({ ok: false, reason: 'no_wikipedia_page' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch Wikipedia summary with timeout
      const wikiController = new AbortController();
      const wikiTimeout = setTimeout(() => wikiController.abort(), 8000);
      
      const wikiResp = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(enWikiTitle)}`,
        { signal: wikiController.signal }
      );
      clearTimeout(wikiTimeout);

      if (!wikiResp.ok) {
        console.log(JSON.stringify({ 
          action: 'fetch-brand-summary', 
          brand_id, 
          ok: false, 
          reason: 'wikipedia_fetch_failed',
          status: wikiResp.status,
          duration_ms: Date.now() - startTime 
        }));
        return new Response(
          JSON.stringify({ ok: false, reason: 'wikipedia_fetch_failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const wikiData = await wikiResp.json();
      let description = wikiData.extract || '';

      // Enhanced sanitization
      description = description
        .replace(/\[\d+\]/g, '') // Remove [1], [2], etc.
        .replace(/\([^)]*citation needed[^)]*\)/gi, '') // Remove citation needed
        .replace(/\s+/g, ' ') // Multiple spaces → single
        .trim();
      
      // Max length (1200 chars)
      if (description.length > 1200) {
        description = description.substring(0, 1197) + '...';
      }

      // Update brand description
      const { error: updateError } = await supabase
        .from('brands')
        .update({
          description,
          description_source: 'wikipedia',
          description_lang: 'en'
        })
        .eq('id', brand_id);

      if (updateError) {
        console.error('Failed to update brand:', updateError);
        console.log(JSON.stringify({ 
          action: 'fetch-brand-summary', 
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
        action: 'fetch-brand-summary', 
        brand_id, 
        ok: true,
        source: 'wikipedia',
        duration_ms: Date.now() - startTime 
      }));

      return new Response(
        JSON.stringify({ ok: true, description }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.log(JSON.stringify({ 
          action: 'fetch-brand-summary', 
          brand_id, 
          ok: false, 
          reason: 'timeout',
          duration_ms: Date.now() - startTime 
        }));
        return new Response(
          JSON.stringify({ ok: false, reason: 'timeout' }),
          { status: 408, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }

  } catch (error) {
    console.error('fetch-brand-summary error:', error);
    console.log(JSON.stringify({ 
      action: 'fetch-brand-summary', 
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