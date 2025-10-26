import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { qid, name, parent_qid } = await req.json();
    
    console.log('[create-brand-from-wikidata] Creating brand:', { qid, name, parent_qid });
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Check if brand already exists
    const { data: existing } = await supabase
      .from('brands')
      .select('id')
      .eq('wikidata_qid', qid)
      .maybeSingle();
    
    if (existing) {
      console.log('[create-brand-from-wikidata] Brand already exists:', existing.id);
      return new Response(JSON.stringify({ 
        success: true, 
        brand_id: existing.id,
        created: false 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Fetch additional data from Wikidata
    const wikidataUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const wikidataRes = await fetch(wikidataUrl);
    const wikidataData = await wikidataRes.json();
    
    const entity = wikidataData.entities[qid];
    const description = entity.descriptions?.en?.value || null;
    const wikipediaTitle = entity.sitelinks?.enwiki?.title || null;
    
    // Get logo from Wikidata (P154 = logo image)
    let logoUrl = null;
    if (entity.claims?.P154) {
      const logoFilename = entity.claims.P154[0].mainsnak.datavalue.value;
      logoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(logoFilename)}`;
    }
    
    // Create the brand
    const { data: newBrand, error: brandError } = await supabase
      .from('brands')
      .insert({
        name: name,
        wikidata_qid: qid,
        description: description,
        description_source: wikipediaTitle ? `Wikipedia: ${wikipediaTitle}` : 'Wikidata',
        logo_url: logoUrl,
        logo_source: 'wikidata',
        is_active: true
      })
      .select('id')
      .single();
    
    if (brandError) throw brandError;
    
    console.log('[create-brand-from-wikidata] Brand created:', newBrand.id);
    console.log('[Bootstrap] 🚀 Starting complete brand setup...');
    
    // BOOTSTRAP PHASE 1: Corporate structure (WAIT for it - synchronous)
    console.log('[Bootstrap] 1/4 Corporate structure...');
    try {
      const { data: treeData, error: treeError } = await supabase.functions.invoke('resolve-wikidata-tree', {
        body: { brand_name: name, qid: qid }
      });
      if (treeError) {
        console.error('[Bootstrap] Corporate structure failed:', treeError);
      } else {
        console.log('[Bootstrap] ✓ Corporate structure complete');
      }
    } catch (e) {
      console.error('[Bootstrap] Corporate structure exception:', e);
    }
    
    // BOOTSTRAP PHASE 2: Key people & shareholders (WAIT for it - synchronous)
    console.log('[Bootstrap] 2/4 Key people & shareholders...');
    try {
      const { data: enrichData, error: enrichError } = await supabase.functions.invoke('enrich-brand-wiki', {
        body: { 
          brand_id: newBrand.id,
          wikidata_qid: qid,
          mode: 'full'
        }
      });
      if (enrichError) {
        console.error('[Bootstrap] Enrichment failed:', enrichError);
      } else {
        console.log('[Bootstrap] ✓ Key people & shareholders complete');
      }
    } catch (e) {
      console.error('[Bootstrap] Enrichment exception:', e);
    }
    
    // BOOTSTRAP PHASE 3: Logo (WAIT for it - synchronous)
    console.log('[Bootstrap] 3/4 Logo...');
    try {
      const { data: logoData, error: logoError } = await supabase.functions.invoke('resolve-brand-logo', {
        body: { brand_id: newBrand.id }
      });
      if (logoError) {
        console.error('[Bootstrap] Logo failed:', logoError);
      } else {
        console.log('[Bootstrap] ✓ Logo complete');
      }
    } catch (e) {
      console.error('[Bootstrap] Logo exception:', e);
    }
    
    // BOOTSTRAP PHASE 4: News ingestion (async, don't wait)
    console.log('[Bootstrap] 4/4 News ingestion (background)...');
    supabase.functions.invoke('trigger-brand-ingestion', {
      body: { 
        brand_id: newBrand.id,
        brand_name: name,
        priority: 'high'
      }
    }).then(() => {
      console.log('[Bootstrap] ✓ News ingestion queued');
    }).catch(e => {
      console.error('[Bootstrap] News ingestion failed:', e);
    });
    
    // Initialize baseline scores
    const { error: scoreError } = await supabase.from('brand_scores').insert({
      brand_id: newBrand.id,
      score: 50,
      score_labor: 50,
      score_environment: 50,
      score_politics: 50,
      score_social: 50
    });
    
    if (scoreError) {
      console.error('[Bootstrap] Score initialization error:', scoreError);
    }
    
    console.log('[Bootstrap] ✅ Complete! Brand is ready.');
    
    return new Response(JSON.stringify({ 
      success: true, 
      brand_id: newBrand.id,
      created: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('[create-brand-from-wikidata] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
