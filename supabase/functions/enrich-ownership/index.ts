import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Background job to enrich brand ownership data from Wikidata/Wikipedia
 * 
 * Usage:
 * POST /enrich-ownership
 * Body: { brand_id: "uuid", brand_name: "Nike" }
 * 
 * Returns: { success: true, edges_added: 2, confidence: 92 }
 */

interface WikidataEntity {
  labels?: { en?: { value: string } };
  claims?: {
    P127?: Array<{ mainsnak: { datavalue?: { value: { id: string } } } }>; // owned by
    P749?: Array<{ mainsnak: { datavalue?: { value: { id: string } } } }>; // parent org
    P355?: Array<{ mainsnak: { datavalue?: { value: { id: string } } } }>; // subsidiary
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_id, brand_name, wikidata_qid } = await req.json();

    if (!brand_id || !brand_name) {
      return new Response(JSON.stringify({ error: 'brand_id and brand_name required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[Enrich] Starting enrichment for ${brand_name} (${brand_id})`);

    let qid = wikidata_qid;
    let confidence = 70;
    const edgesAdded: string[] = [];

    // Step 1: If no QID, try to find it via Wikidata search
    if (!qid) {
      console.log(`[Enrich] No QID provided, searching Wikidata for "${brand_name}"`);
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(brand_name)}&language=en&format=json&type=item&limit=1`;
      
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      if (searchData.search && searchData.search.length > 0) {
        qid = searchData.search[0].id;
        confidence = 75; // Lower confidence for auto-matched QID
        console.log(`[Enrich] Found QID: ${qid}`);
      } else {
        console.log(`[Enrich] No Wikidata entity found for "${brand_name}"`);
        return new Response(JSON.stringify({ 
          success: false, 
          message: `No Wikidata entity found for "${brand_name}"` 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Step 2: Fetch entity data from Wikidata
    console.log(`[Enrich] Fetching Wikidata entity ${qid}`);
    const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
    const entityRes = await fetch(entityUrl);
    const entityData = await entityRes.json();
    
    const entity = entityData.entities?.[qid] as WikidataEntity | undefined;
    if (!entity) {
      console.log(`[Enrich] Entity ${qid} not found in Wikidata`);
      return new Response(JSON.stringify({ 
        success: false, 
        message: `Entity ${qid} not found` 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Step 3: Extract parent relationships
    const parentQids: Array<{ qid: string; relationship: 'owned_by' | 'parent_org' }> = [];

    // P127: owned by
    const ownedBy = entity.claims?.P127;
    if (ownedBy) {
      for (const claim of ownedBy) {
        // Safety check for nested property access
        const parentQid = claim?.mainsnak?.datavalue?.value?.id;
        if (parentQid && typeof parentQid === 'string') {
          parentQids.push({ qid: parentQid, relationship: 'owned_by' });
        }
      }
    }

    // P749: parent organization
    const parentOrg = entity.claims?.P749;
    if (parentOrg) {
      for (const claim of parentOrg) {
        // Safety check for nested property access
        const parentQid = claim?.mainsnak?.datavalue?.value?.id;
        if (parentQid && typeof parentQid === 'string') {
          parentQids.push({ qid: parentQid, relationship: 'parent_org' });
        }
      }
    }

    console.log(`[Enrich] Found ${parentQids.length} parent relationships`);

    // Step 4: For each parent, try to find/create in our brands table
    for (const parent of parentQids) {
      // Fetch parent entity name
      const parentEntityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${parent.qid}.json`;
      const parentEntityRes = await fetch(parentEntityUrl);
      const parentEntityData = await parentEntityRes.json();
      const parentEntity = parentEntityData.entities?.[parent.qid] as WikidataEntity | undefined;
      
      // Safety check for label existence and value
      if (!parentEntity?.labels?.en?.value) {
        console.log(`[Enrich] No English label for parent ${parent.qid}, skipping`);
        continue;
      }

      const parentName = parentEntity.labels.en.value;
      console.log(`[Enrich] Processing parent: ${parentName} (${parent.qid})`);

      // Check if parent brand exists in our DB
      const { data: existingParent } = await supabase
        .from('brands')
        .select('id, name, wikidata_qid')
        .eq('wikidata_qid', parent.qid)
        .maybeSingle();

      let parentBrandId: string;

      if (existingParent) {
        parentBrandId = existingParent.id;
        console.log(`[Enrich] Parent already exists: ${existingParent.name}`);
      } else {
        // Create parent brand
        const { data: newParent, error: insertError } = await supabase
          .from('brands')
          .insert({ 
            name: parentName, 
            wikidata_qid: parent.qid 
          })
          .select('id')
          .single();

        if (insertError || !newParent) {
          console.error(`[Enrich] Failed to create parent brand: ${insertError?.message}`);
          continue;
        }

        parentBrandId = newParent.id;
        console.log(`[Enrich] Created parent brand: ${parentName}`);
      }

      // Insert ownership edge
      const relationshipType = parent.relationship === 'owned_by' ? 'brand_of' : 'subsidiary_of';
      
      const { error: ownershipError } = await supabase
        .from('brand_ownerships')
        .upsert({
          brand_id,
          parent_brand_id: parentBrandId,
          relationship_type: relationshipType,
          source: 'Wikidata',
          source_url: `https://www.wikidata.org/wiki/${qid}`,
          confidence: confidence
        }, {
          onConflict: 'brand_id,parent_brand_id,relationship_type'
        });

      if (ownershipError) {
        console.error(`[Enrich] Failed to create ownership edge: ${ownershipError.message}`);
      } else {
        edgesAdded.push(parentName);
        console.log(`[Enrich] Added edge: ${brand_name} → ${parentName}`);
      }
    }

    // Step 5: Update brand with wikidata_qid if not set
    if (qid) {
      await supabase
        .from('brands')
        .update({ wikidata_qid: qid })
        .eq('id', brand_id);
    }

    console.log(`[Enrich] Enrichment complete. Added ${edgesAdded.length} edges.`);

    return new Response(JSON.stringify({ 
      success: true, 
      edges_added: edgesAdded.length,
      parents: edgesAdded,
      confidence,
      wikidata_qid: qid
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Enrich] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
