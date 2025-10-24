import { corsHeaders } from "../_shared/cors.ts";

interface RelatedEntity {
  id: string;
  name: string;
  type: 'parent' | 'sibling' | 'cousin' | 'subsidiary';
  qid: string;
}

interface OwnershipGraph {
  entity_qid: string;
  entity_name: string;
  parent?: RelatedEntity;
  siblings: RelatedEntity[];
  cousins: RelatedEntity[];
  subsidiaries: RelatedEntity[];
}

async function getOwnershipGraph(brandName: string): Promise<OwnershipGraph> {
  console.log('[Wikidata] Searching for:', brandName);
  
  // Step 1: Find the brand's QID
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
  const qid = selectedEntity.id;
  console.log('[Wikidata] Found QID:', qid, 'for', brandName);
  
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
        # Get subsidiaries (P355 = subsidiary)
        ?entity wdt:P355 ?item .
        BIND("subsidiary" AS ?type)
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
  
  // Parse results
  let parent: RelatedEntity | undefined;
  const siblings: RelatedEntity[] = [];
  const cousins: RelatedEntity[] = [];
  const subsidiaries: RelatedEntity[] = [];
  
  for (const binding of sparqlData.results.bindings) {
    const itemQid = binding.item.value.split('/').pop();
    const itemName = binding.itemLabel.value;
    const type = binding.type.value;
    
    const relatedEntity: RelatedEntity = {
      id: itemQid,
      name: itemName,
      type: type as any,
      qid: itemQid
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
    entity_name: selectedEntity.label,
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
    const { brand_name } = await req.json();
    console.log('[resolve-wikidata-tree] Brand name:', brand_name);
    
    // Input validation
    if (!brand_name || typeof brand_name !== 'string') {
      return new Response(
        JSON.stringify({ error: 'brand_name must be a non-empty string' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (brand_name.length > 100) {
      return new Response(
        JSON.stringify({ error: 'brand_name must be less than 100 characters' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('[resolve-wikidata-tree] Calling getOwnershipGraph');
    const graph = await getOwnershipGraph(brand_name);
    console.log('[resolve-wikidata-tree] Graph received:', JSON.stringify(graph).substring(0, 200));
    
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
