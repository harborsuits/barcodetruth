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
      return new Response(
        JSON.stringify({ ok: false, reason: 'manual_override' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!brand.wikidata_qid) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'no_wikidata' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Wikipedia page title from Wikidata
    const wikidataResp = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${brand.wikidata_qid}.json`
    );
    
    if (!wikidataResp.ok) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'wikidata_fetch_failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const wikidataJson = await wikidataResp.json();
    const entity = wikidataJson.entities[brand.wikidata_qid];
    const enWikiTitle = entity?.sitelinks?.enwiki?.title;

    if (!enWikiTitle) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'no_wikipedia_page' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch Wikipedia summary
    const wikiResp = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(enWikiTitle)}`
    );

    if (!wikiResp.ok) {
      return new Response(
        JSON.stringify({ ok: false, reason: 'wikipedia_fetch_failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const wikiData = await wikiResp.json();
    let description = wikiData.extract || '';

    // Sanitize: remove citation markers, footnotes
    description = description
      .replace(/\[\d+\]/g, '') // Remove [1], [2], etc.
      .replace(/\([^)]*citation needed[^)]*\)/gi, '') // Remove citation needed
      .trim();

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
      return new Response(
        JSON.stringify({ error: 'Failed to update brand' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true, description }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('fetch-brand-summary error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});