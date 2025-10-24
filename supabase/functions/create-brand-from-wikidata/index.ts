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
    
    let parentCompany = null;
    
    // If parent provided, create the ownership link
    if (parent_qid) {
      // Find or create parent company
      const { data: existingParent } = await supabase
        .from('companies')
        .select('id, name')
        .eq('wikidata_qid', parent_qid)
        .maybeSingle();
      
      if (existingParent) {
        parentCompany = existingParent;
      } else {
        // Create parent company
        const { data: newParent } = await supabase
          .from('companies')
          .insert({
            name: name.split(' ')[0], // Use first word as company name
            wikidata_qid: parent_qid
          })
          .select('id, name')
          .single();
        
        parentCompany = newParent;
      }
      
      if (parentCompany) {
        // Create ownership link
        await supabase
          .from('company_ownership')
          .insert({
            child_brand_id: newBrand.id,
            parent_company_id: parentCompany.id,
            parent_name: parentCompany.name,
            relationship: 'subsidiary',
            source: 'wikidata',
            confidence: 0.9
          });
        
        console.log('[create-brand-from-wikidata] Ownership link created');
      }
    }
    
    // STEP 1: Trigger Wikipedia enrichment (background, don't await)
    console.log('[create-brand-from-wikidata] Triggering Wikipedia enrichment');
    supabase.functions.invoke('enrich-brand-wiki', {
      body: { brand_id: newBrand.id }
    }).then(() => {
      console.log('[create-brand-from-wikidata] Enrichment triggered');
    });
    
    // STEP 2: Start news ingestion if we have a parent company (background, don't await)
    if (parentCompany) {
      console.log('[create-brand-from-wikidata] Starting news ingestion');
      supabase.functions.invoke('trigger-brand-ingestion', {
        body: { 
          brand_id: newBrand.id,
          brand_name: name
        }
      }).then(() => {
        console.log('[create-brand-from-wikidata] News ingestion triggered');
      });
    }
    
    // STEP 3: Initialize default scores
    console.log('[create-brand-from-wikidata] Initializing baseline scores');
    const { error: scoreError } = await supabase.from('brand_scores').insert({
      brand_id: newBrand.id,
      score: 50,
      score_labor: 50,
      score_environment: 50,
      score_politics: 50,
      score_social: 50
    });
    
    if (scoreError) {
      console.error('[create-brand-from-wikidata] Score initialization error:', scoreError);
    }
    
    console.log('[create-brand-from-wikidata] Full enrichment pipeline triggered');
    
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
