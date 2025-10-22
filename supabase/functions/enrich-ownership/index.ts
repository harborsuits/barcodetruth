import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Enrich brand ownership from Wikidata
 * Writes to: company_ownership (canonical table)
 * Properties: P749 (parent org), P355 (subsidiary)
 */

interface WikidataEntity {
  labels?: { en?: { value: string } };
  claims?: {
    P749?: Array<{ mainsnak: { datavalue?: { value: { id: string } } } }>; // parent org
    P355?: Array<{ mainsnak: { datavalue?: { value: { id: string } } } }>; // subsidiary
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let brandId: string | null = null;
  let rowsWritten = 0;
  let status = 'success';
  let errorMsg: string | null = null;

  try {
    const { brand_id, wikidata_qid } = await req.json();

    if (!brand_id) {
      return new Response(JSON.stringify({ error: 'brand_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    brandId = brand_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[enrich-ownership] Starting enrichment for brand ${brand_id}`);

    let qid = wikidata_qid;
    
    // Get brand and its company if exists
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select(`
        id,
        name,
        wikidata_qid,
        company_ownership!company_ownership_child_brand_id_fkey (
          parent_company_id,
          companies!company_ownership_parent_company_id_fkey (
            id,
            wikidata_qid
          )
        )
      `)
      .eq('id', brand_id)
      .single();

    if (brandError || !brand) {
      errorMsg = 'Brand not found';
      status = 'failed';
      throw new Error(errorMsg);
    }

    if (!qid) {
      qid = brand.wikidata_qid;
    }

    // If no QID, try to find it
    if (!qid) {
      console.log(`[enrich-ownership] No QID, searching Wikidata for "${brand.name}"`);
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(brand.name)}&language=en&format=json&type=item&limit=1`;
      
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (searchData.search && searchData.search.length > 0) {
        qid = searchData.search[0].id;
        console.log(`[enrich-ownership] Found QID: ${qid}`);
        
        // Update brand with QID
        await supabase
          .from('brands')
          .update({ wikidata_qid: qid })
          .eq('id', brand_id);
      } else {
        errorMsg = 'No Wikidata entity found';
        status = 'failed';
        throw new Error(errorMsg);
      }
    }

    // Fetch entity data from Wikidata
    console.log(`[enrich-ownership] Fetching Wikidata entity ${qid}`);
    const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const entityRes = await fetch(entityUrl);
    const entityData = await entityRes.json();
    
    const entity = entityData.entities?.[qid] as WikidataEntity | undefined;
    if (!entity) {
      errorMsg = `Entity ${qid} not found`;
      status = 'failed';
      throw new Error(errorMsg);
    }

    // Extract parent relationships (P749 only - parent organization)
    const parentQids: string[] = [];
    const parentOrg = entity.claims?.P749;
    if (parentOrg) {
      for (const claim of parentOrg) {
        const parentQid = claim?.mainsnak?.datavalue?.value?.id;
        if (parentQid && typeof parentQid === 'string') {
          parentQids.push(parentQid);
        }
      }
    }

    console.log(`[enrich-ownership] Found ${parentQids.length} parent organizations`);

    // Process each parent
    for (const parentQid of parentQids) {
      // Fetch parent entity
      const parentEntityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${parentQid}.json`;
      const parentEntityRes = await fetch(parentEntityUrl);
      const parentEntityData = await parentEntityRes.json();
      const parentEntity = parentEntityData.entities?.[parentQid] as WikidataEntity | undefined;
      
      if (!parentEntity?.labels?.en?.value) {
        console.log(`[enrich-ownership] No English label for parent ${parentQid}, skipping`);
        continue;
      }

      const parentName = parentEntity.labels.en.value;
      console.log(`[enrich-ownership] Processing parent: ${parentName} (${parentQid})`);

      // Find or create parent company
      let { data: parentCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('wikidata_qid', parentQid)
        .maybeSingle();

      let parentCompanyId: string;

      if (parentCompany) {
        parentCompanyId = parentCompany.id;
        console.log(`[enrich-ownership] Parent company exists: ${parentName}`);
      } else {
        // Create parent company
        const { data: newCompany, error: insertError } = await supabase
          .from('companies')
          .insert({ 
            name: parentName, 
            wikidata_qid: parentQid 
          })
          .select('id')
          .single();

        if (insertError || !newCompany) {
          console.error(`[enrich-ownership] Failed to create parent company: ${insertError?.message}`);
          continue;
        }

        parentCompanyId = newCompany.id;
        console.log(`[enrich-ownership] Created parent company: ${parentName}`);
      }

      // Insert ownership relationship (idempotent)
      const { error: ownershipError } = await supabase
        .from('company_ownership')
        .upsert({
          parent_company_id: parentCompanyId,
          child_brand_id: brand_id,
          relationship_type: 'parent_organization',
          source: 'wikidata',
          source_ref: `https://www.wikidata.org/wiki/${qid}`,
          confidence: 0.90,
          last_verified_at: new Date().toISOString()
        }, {
          onConflict: 'parent_company_id,child_brand_id'
        });

      if (ownershipError) {
        console.error(`[enrich-ownership] Failed to create ownership edge: ${ownershipError.message}`);
        if (status === 'success') status = 'partial';
      } else {
        rowsWritten++;
        console.log(`[enrich-ownership] Added edge: ${brand.name} → ${parentName}`);
      }
    }

    // Log enrichment run
    await supabase.from('enrichment_runs').insert({
      brand_id: brandId,
      task: 'ownership',
      rows_written: rowsWritten,
      status: rowsWritten > 0 ? 'success' : (status === 'failed' ? 'failed' : 'partial'),
      error: errorMsg,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime
    });

    console.log(`[enrich-ownership] Enrichment complete. Added ${rowsWritten} edges.`);

    return new Response(JSON.stringify({ 
      success: rowsWritten > 0, 
      rows_written: rowsWritten,
      wikidata_qid: qid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[enrich-ownership] Error:', error);
    
    // Log failed run
    if (brandId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );
        await supabase.from('enrichment_runs').insert({
          brand_id: brandId,
          task: 'ownership',
          rows_written: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        });
      } catch {}
    }

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
