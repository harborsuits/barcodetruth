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

interface WikidataSearchResult {
  search?: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
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

async function searchWikidataForBrand(brandName: string): Promise<string | null> {
  try {
    const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(brandName)}&language=en&format=json&type=item&limit=5`;
    
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'BrandScanner/1.0' },
      signal: AbortSignal.timeout(5000)
    });
    
    if (!response.ok) return null;
    
    const data = await response.json() as WikidataSearchResult;
    const results = data.search || [];
    
    // Filter for company/brand entities only
    const companyResults = results.filter(r => {
      const desc = r.description?.toLowerCase() || '';
      return desc.includes('company') || 
             desc.includes('brand') || 
             desc.includes('corporation') ||
             desc.includes('business');
    });
    
    // Return the first match if it's a good match
    if (companyResults.length > 0) {
      const best = companyResults[0];
      const similarity = fuzzyMatch(brandName, best.label);
      if (similarity) {
        console.log(`Found match for "${brandName}": ${best.id} (${best.label})`);
        return best.id;
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Failed to search Wikidata for ${brandName}:`, error);
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
    const autoFixed = [];
    const needsManualReview = [];

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
        await new Promise(resolve => setTimeout(resolve, 1000));
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
        console.log(`[validate-qids] Mismatch: "${brand.name}" vs "${wikidataLabel}" - searching for correct QID`);
        mismatches.push({
          brand_id: brand.id,
          brand_name: brand.name,
          old_qid: brand.wikidata_qid,
          wikidata_label: wikidataLabel
        });
        
        // Try to find correct QID
        const correctQid = await searchWikidataForBrand(brand.name);
        
        if (correctQid && correctQid !== brand.wikidata_qid) {
          // Auto-fix the QID in database
          const { error: updateError } = await supabase
            .from('brands')
            .update({ wikidata_qid: correctQid })
            .eq('id', brand.id);
          
          if (!updateError) {
            // Also update companies table
            await supabase
              .from('companies')
              .update({ wikidata_qid: correctQid })
              .eq('name', brand.name);
            
            autoFixed.push({
              brand_id: brand.id,
              brand_name: brand.name,
              old_qid: brand.wikidata_qid,
              new_qid: correctQid,
              old_label: wikidataLabel
            });
            
            console.log(`[validate-qids] Auto-fixed: ${brand.name} from ${brand.wikidata_qid} to ${correctQid}`);
          }
        } else {
          needsManualReview.push({
            brand_id: brand.id,
            brand_name: brand.name,
            current_qid: brand.wikidata_qid,
            wikidata_label: wikidataLabel
          });
        }
      }

      // Rate limit: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`[validate-qids] Complete: ${matches.length} matches, ${autoFixed.length} auto-fixed, ${needsManualReview.length} need manual review, ${errors.length} errors`);

    return new Response(
      JSON.stringify({
        total_brands: brands.length,
        matches: matches.length,
        auto_fixed: autoFixed.length,
        needs_manual_review: needsManualReview.length,
        errors: errors.length,
        auto_fixed_list: autoFixed,
        needs_manual_review_list: needsManualReview,
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
