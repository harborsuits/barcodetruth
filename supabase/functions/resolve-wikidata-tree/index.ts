import { corsHeaders } from "../_shared/cors.ts";

interface RelatedEntity {
  id: string;
  name: string;
  type: 'parent' | 'sibling' | 'cousin' | 'subsidiary';
  qid: string;
  logo_url?: string;
}

interface OwnershipGraph {
  entity_qid: string;
  entity_name: string;
  parent?: RelatedEntity;
  siblings: RelatedEntity[];
  cousins: RelatedEntity[];
  subsidiaries: RelatedEntity[];
}

async function getOwnershipGraph(brandName: string, explicitQid?: string): Promise<OwnershipGraph> {
  let qid: string;
  let entityLabel: string;

  // CRITICAL: If QID is explicitly provided, use it directly (skips unreliable name search)
  if (explicitQid) {
    console.log('[Wikidata] Using explicit QID:', explicitQid);
    qid = explicitQid;
    
    // Fetch entity label for the QID
    try {
      const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
      const entityRes = await fetch(entityUrl, {
        headers: {
          'User-Agent': 'LovableApp/1.0 (+https://lovable.dev)',
          'Accept': 'application/json'
        }
      });
      
      if (entityRes.ok) {
        const entityData = await entityRes.json();
        const entity = entityData.entities[qid];
        entityLabel = entity.labels?.en?.value || brandName;
        console.log('[Wikidata] Fetched label for QID:', entityLabel);
      } else {
        console.warn('[Wikidata] Could not fetch entity data, using brand name as label');
        entityLabel = brandName;
      }
    } catch (e) {
      console.warn('[Wikidata] Error fetching entity:', e);
      entityLabel = brandName;
    }
  } else {
    // Fallback to name search (less reliable)
    console.log('[Wikidata] Searching by name:', brandName);
    
    const baseUrl = 'https://www.wikidata.org/w/api.php';
    const makeSearch = async (query: string) => {
      const url = `${baseUrl}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&type=item&limit=5&origin=*`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'LovableApp/1.0 (+https://lovable.dev)', 'Accept': 'application/json' }
      });
      if (!res.ok) throw new Error(`Wikidata search failed: ${res.status}`);
      return res.json();
    };

    let searchData = await makeSearch(brandName + ' company');
    if (!searchData?.search?.length) {
      console.log('[Wikidata] Primary search empty, retrying with plain name');
      searchData = await makeSearch(brandName);
    }
    
    if (!searchData?.search || searchData.search.length === 0) {
      throw new Error('Entity not found in Wikidata');
    }
    
    // Use first result - Wikidata search is already relevant
    const selectedEntity = searchData.search[0];
    console.log('[Wikidata] Using first result:', selectedEntity.id, selectedEntity.label);
    qid = selectedEntity.id;
    entityLabel = selectedEntity.label;
    console.log('[Wikidata] Found QID:', qid, 'for', brandName);
  }
  
  // Step 2: SPARQL query to get the full graph
  const sparqlQuery = `
    SELECT DISTINCT ?item ?itemLabel ?type WHERE {
      # Our entity
      BIND(wd:${qid} AS ?entity)
      
      {
        # Get parent (P749 = parent organization)
        ?entity wdt:P749 ?item .
        BIND("parent" AS ?type)
      }
      UNION
      {
        # Get siblings (entities with same parent)
        ?entity wdt:P749 ?parent .
        ?item wdt:P749 ?parent .
        FILTER(?item != ?entity)
        BIND("sibling" AS ?type)
      }
      UNION
      {
        # EXPANDED: Get ALL entities owned/operated by this entity
        {
          # Method 1: Explicitly marked as subsidiary (P355)
          ?entity wdt:P355 ?item .
          BIND("subsidiary" AS ?type)
        }
        UNION
        {
          # Method 2: Entity is owned by this brand (P127 - reversed)
          ?item wdt:P127 ?entity .
          BIND("subsidiary" AS ?type)
        }
        UNION
        {
          # Method 3: This brand is parent organization (P749 - reversed)
          ?item wdt:P749 ?entity .
          BIND("subsidiary" AS ?type)
        }
        UNION
        {
          # Method 4: This brand owns the entity (P1830)
          ?entity wdt:P1830 ?item .
          BIND("subsidiary" AS ?type)
        }
        UNION
        {
          # Method 5: This brand operates the entity (P137)
          ?entity wdt:P137 ?item .
          BIND("subsidiary" AS ?type)
        }
      }
      UNION
      {
        # Get cousins (children of parent's siblings)
        ?entity wdt:P749 ?parent .
        ?parent wdt:P749 ?grandparent .
        ?uncle wdt:P749 ?grandparent .
        ?item wdt:P749 ?uncle .
        FILTER(?uncle != ?parent)
        FILTER(?item != ?entity)
        BIND("cousin" AS ?type)
      }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
    LIMIT 100
  `;
  
  const sparqlUrl = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
  
  const sparqlRes = await fetch(sparqlUrl, {
    headers: {
      'User-Agent': 'BarcodeScanner/1.0',
      'Accept': 'application/json'
    }
  });
  
  if (!sparqlRes.ok) {
    throw new Error(`SPARQL query failed: ${sparqlRes.statusText}`);
  }
  
  const sparqlData = await sparqlRes.json();
  console.log('[Wikidata] SPARQL returned', sparqlData.results?.bindings?.length || 0, 'results');
  
  // Parse results
  let parent: RelatedEntity | undefined;
  const siblings: RelatedEntity[] = [];
  const cousins: RelatedEntity[] = [];
  const subsidiaries: RelatedEntity[] = [];
  
  if (!sparqlData.results?.bindings) {
    console.log('[Wikidata] WARNING: No bindings in SPARQL response');
  }
  
  for (const binding of sparqlData.results?.bindings || []) {
    const itemQid = binding.item.value.split('/').pop();
    const itemName = binding.itemLabel.value;
    const type = binding.type.value;
    
    // Fetch logo for this entity
    let logoUrl = null;
    try {
      const entityUrl = `https://www.wikidata.org/wiki/Special:EntityData/${itemQid}.json`;
      const entityRes = await fetch(entityUrl, {
        headers: {
          'User-Agent': 'BarcodeScanner/1.0',
          'Accept': 'application/json'
        }
      });
      
      if (entityRes.ok) {
        const entityData = await entityRes.json();
        const entity = entityData.entities[itemQid];
        
        if (entity.claims?.P154) {
          const logoFilename = entity.claims.P154[0].mainsnak.datavalue.value;
          logoUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(logoFilename)}`;
        }
      }
    } catch (e) {
      console.log('[Wikidata] Could not fetch logo for:', itemName);
    }
    
      const relatedEntity: RelatedEntity = {
        id: itemQid,
        name: itemName,
        type: type as any,
        qid: itemQid,
        logo_url: logoUrl || undefined
      };
    
    if (type === 'parent') {
      parent = relatedEntity;
    } else if (type === 'sibling') {
      siblings.push(relatedEntity);
    } else if (type === 'cousin') {
      cousins.push(relatedEntity);
    } else if (type === 'subsidiary') {
      subsidiaries.push(relatedEntity);
    }
  }
  
  console.log('[Wikidata] Found:', {
    parent: parent?.name,
    siblings: siblings.length,
    cousins: cousins.length,
    subsidiaries: subsidiaries.length
  });
  
  return {
    entity_qid: qid,
    entity_name: entityLabel,
    parent,
    siblings,
    cousins,
    subsidiaries
  };
}

Deno.serve(async (req) => {
  console.log('[resolve-wikidata-tree] Request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    console.log('[resolve-wikidata-tree] Parsing request body');
    const { brand_name, qid } = await req.json();
    console.log('[resolve-wikidata-tree] Brand name:', brand_name, 'QID:', qid);
    
    // Input validation: Either qid or brand_name must be provided
    if (!qid && (!brand_name || typeof brand_name !== 'string')) {
      return new Response(
        JSON.stringify({ error: 'Either qid or brand_name must be provided' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (brand_name && brand_name.length > 100) {
      return new Response(
        JSON.stringify({ error: 'brand_name must be less than 100 characters' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('[resolve-wikidata-tree] Calling getOwnershipGraph with', qid ? 'explicit QID' : 'name search');
    const graph = await getOwnershipGraph(brand_name || 'Unknown', qid);
    console.log('[resolve-wikidata-tree] Graph received:', JSON.stringify(graph).substring(0, 200));
    console.log('[resolve-wikidata-tree] Full graph structure:', {
      entity_qid: graph.entity_qid,
      entity_name: graph.entity_name,
      has_parent: !!graph.parent,
      siblings_count: graph.siblings.length,
      cousins_count: graph.cousins.length,
      subsidiaries_count: graph.subsidiaries.length
    });
    
    return new Response(JSON.stringify({ success: true, graph }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('[resolve-wikidata-tree] ERROR:', error.message);
    console.error('[resolve-wikidata-tree] Stack:', error.stack);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }),
      { 
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    );
  }
});
