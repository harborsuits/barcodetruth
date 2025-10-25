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
      console.log('[create-brand-from-wikidata] Resolving parent company:', parent_qid);
      
      // Find or create parent company WITH full Wikidata enrichment
      const { data: existingParent } = await supabase
        .from('companies')
        .select('id, name, wikidata_qid')
        .eq('wikidata_qid', parent_qid)
        .maybeSingle();
      
      if (existingParent) {
        parentCompany = existingParent;
        console.log('[create-brand-from-wikidata] Found existing company:', existingParent.id);
      } else {
        // Fetch parent company data from Wikidata
        console.log('[create-brand-from-wikidata] Fetching parent company from Wikidata');
        const parentWikidataUrl = `https://www.wikidata.org/wiki/Special:EntityData/${parent_qid}.json`;
        const parentWikidataRes = await fetch(parentWikidataUrl);
        const parentWikidataData = await parentWikidataRes.json();
        
        const parentEntity = parentWikidataData.entities[parent_qid];
        const parentName = parentEntity.labels?.en?.value || name;
        const parentDescription = parentEntity.descriptions?.en?.value || null;
        
        // Create parent company with full details
        const { data: newParent, error: companyError } = await supabase
          .from('companies')
          .insert({
            name: parentName,
            wikidata_qid: parent_qid,
            description: parentDescription,
            description_source: 'wikidata',
            created_at: new Date().toISOString()
          })
          .select('id, name, wikidata_qid')
          .single();
        
        if (companyError) {
          console.error('[create-brand-from-wikidata] Company creation error:', companyError);
        } else {
          parentCompany = newParent;
          console.log('[create-brand-from-wikidata] Created new company:', newParent.id);
          
          // IMMEDIATELY enrich the company's key people
          console.log('[create-brand-from-wikidata] Triggering key people enrichment');
          supabase.functions.invoke('enrich-key-people', {
            body: {
              company_id: newParent.id,
              wikidata_qid: parent_qid
            }
          }).then(({ data: enrichData, error: enrichError }) => {
            if (enrichError) {
              console.error('[create-brand-from-wikidata] Key people enrichment error:', enrichError);
            } else {
              console.log('[create-brand-from-wikidata] Key people enriched:', enrichData);
            }
          });
        }
      }
      
      if (parentCompany) {
        // Create ownership link with company_id
        const { error: ownershipError } = await supabase
          .from('company_ownership')
          .upsert({
            child_brand_id: newBrand.id,
            parent_company_id: parentCompany.id,
            parent_name: parentCompany.name,
            relationship: 'subsidiary',
            source: 'wikidata',
            confidence: 0.9
          }, {
            onConflict: 'child_brand_id,parent_company_id'
          });
        
        if (ownershipError) {
          console.error('[create-brand-from-wikidata] Ownership link error:', ownershipError);
        } else {
          console.log('[create-brand-from-wikidata] Ownership link created');
        }
      }
    }
    
    // STEP 1: Trigger FULL Wikipedia enrichment (people + shareholders)
    console.log('[create-brand-from-wikidata] Triggering FULL Wikipedia enrichment');
    supabase.functions.invoke('enrich-brand-wiki', {
      body: { 
        brand_id: newBrand.id,
        wikidata_qid: qid,
        mode: 'full'  // Force full enrichment including key people
      }
    }).then(({ data: enrichData, error: enrichError }) => {
      if (enrichError) {
        console.error('[create-brand-from-wikidata] Full enrichment error:', enrichError);
      } else {
        console.log('[create-brand-from-wikidata] Full enrichment triggered:', enrichData);
      }
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
