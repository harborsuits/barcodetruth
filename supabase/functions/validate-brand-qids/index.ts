import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WikidataEntity {
  labels?: {
    en?: {
      value: string;
    };
  };
}

async function fetchWikidataLabel(qid: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
      { 
        headers: { 'User-Agent': 'BrandScanner/1.0' },
        signal: AbortSignal.timeout(5000)
      }
    );
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const entity = data.entities?.[qid] as WikidataEntity;
    return entity?.labels?.en?.value || null;
  } catch (error) {
    console.error(`Failed to fetch QID ${qid}:`, error);
    return null;
  }
}

function fuzzyMatch(str1: string, str2: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const n1 = normalize(str1);
  const n2 = normalize(str2);
  
  // Exact match
  if (n1 === n2) return true;
  
  // Contains match
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Levenshtein distance check (simple version)
  const longer = n1.length > n2.length ? n1 : n2;
  const shorter = n1.length > n2.length ? n2 : n1;
  
  if (longer.length === 0) return true;
  
  let distance = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] !== shorter[i]) distance++;
  }
  distance += longer.length - shorter.length;
  
  const similarity = 1 - distance / longer.length;
  return similarity > 0.7; // 70% similarity threshold
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[validate-qids] Starting QID validation');

    // Fetch all brands with QIDs
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, name, wikidata_qid')
      .not('wikidata_qid', 'is', null)
      .order('name');

    if (brandsError) throw brandsError;

    console.log(`[validate-qids] Found ${brands.length} brands with QIDs`);

    const mismatches = [];
    const matches = [];
    const errors = [];

    for (const brand of brands) {
      console.log(`[validate-qids] Checking ${brand.name} (${brand.wikidata_qid})`);
      
      const wikidataLabel = await fetchWikidataLabel(brand.wikidata_qid);
      
      if (!wikidataLabel) {
        errors.push({
          brand_id: brand.id,
          brand_name: brand.name,
          wikidata_qid: brand.wikidata_qid,
          error: 'Failed to fetch Wikidata label'
        });
        continue;
      }

      const isMatch = fuzzyMatch(brand.name, wikidataLabel);

      if (isMatch) {
        matches.push({
          brand_id: brand.id,
          brand_name: brand.name,
          wikidata_qid: brand.wikidata_qid,
          wikidata_label: wikidataLabel
        });
      } else {
        mismatches.push({
          brand_id: brand.id,
          brand_name: brand.name,
          wikidata_qid: brand.wikidata_qid,
          wikidata_label: wikidataLabel,
          confidence: 'mismatch'
        });
      }

      // Rate limit: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[validate-qids] Complete: ${matches.length} matches, ${mismatches.length} mismatches, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        total_brands: brands.length,
        matches: matches.length,
        mismatches: mismatches.length,
        errors: errors.length,
        mismatch_list: mismatches,
        error_list: errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[validate-qids] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
