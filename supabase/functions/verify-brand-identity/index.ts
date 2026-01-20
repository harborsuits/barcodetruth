import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WikidataSearchResult {
  id: string;
  label: string;
  description?: string;
  aliases?: string[];
}

interface WikidataEntity {
  labels?: { en?: { value: string } };
  descriptions?: { en?: { value: string } };
  claims?: {
    P856?: Array<{ mainsnak: { datavalue?: { value: string } } }>; // official website
    P154?: Array<{ mainsnak: { datavalue?: { value: string } } }>; // logo image
    P17?: Array<{ mainsnak: { datavalue?: { value: { id: string } } } }>; // country
    P452?: Array<{ mainsnak: { datavalue?: { value: { id: string } } } }>; // industry
    P31?: Array<{ mainsnak: { datavalue?: { value: { id: string } } } }>; // instance of
    P749?: Array<{ mainsnak: { datavalue?: { value: { id: string } } } }>; // parent org
  };
}

interface Candidate {
  candidate_qid: string;
  candidate_name: string;
  candidate_domain: string | null;
  score: number;
  reasons: string[];
  source: string;
}

// Normalize domain for comparison
function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const hostname = url.includes('://') 
      ? new URL(url).hostname 
      : url.split('/')[0];
    return hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0].toLowerCase();
  }
}

// Simple string similarity (Levenshtein-based)
function stringSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  
  if (aLower === bLower) return 1;
  if (aLower.length === 0 || bLower.length === 0) return 0;
  
  // Check if one contains the other
  if (aLower.includes(bLower) || bLower.includes(aLower)) {
    return 0.85;
  }
  
  // Simple Levenshtein distance ratio
  const maxLen = Math.max(aLower.length, bLower.length);
  let distance = 0;
  
  for (let i = 0; i < maxLen; i++) {
    if (aLower[i] !== bLower[i]) distance++;
  }
  
  return 1 - (distance / maxLen);
}

// Search Wikidata for entity candidates
async function searchWikidata(query: string, limit = 5): Promise<WikidataSearchResult[]> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&limit=${limit}&type=item`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BarcodeApp/1.0' }
    });
    const data = await response.json();
    return data.search || [];
  } catch (error) {
    console.error('Wikidata search error:', error);
    return [];
  }
}

// Get entity details from Wikidata
async function getWikidataEntity(qid: string): Promise<WikidataEntity | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&format=json&props=labels|descriptions|claims`;
  
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'BarcodeApp/1.0' }
    });
    const data = await response.json();
    return data.entities?.[qid] || null;
  } catch (error) {
    console.error('Wikidata entity fetch error:', error);
    return null;
  }
}

// Extract official website from Wikidata entity
function extractWebsite(entity: WikidataEntity): string | null {
  const websites = entity.claims?.P856;
  if (!websites || websites.length === 0) return null;
  return websites[0]?.mainsnak?.datavalue?.value || null;
}

// Check if entity is a company/organization
function isCompanyOrOrg(entity: WikidataEntity): boolean {
  const instanceOf = entity.claims?.P31 || [];
  const companyTypes = [
    'Q4830453', // business
    'Q6881511', // enterprise
    'Q891723', // public company
    'Q1608824', // private company
    'Q7275', // state enterprise
    'Q43229', // organization
    'Q4830453', // business enterprise
    'Q783794', // company
  ];
  
  for (const claim of instanceOf) {
    const typeId = claim.mainsnak?.datavalue?.value?.id;
    if (typeId && companyTypes.includes(typeId)) {
      return true;
    }
  }
  
  return instanceOf.length === 0; // Allow if no type info
}

// Score a candidate entity
function scoreCandidate(
  brandName: string,
  brandDomain: string | null,
  brandTicker: string | null,
  entity: WikidataEntity,
  qid: string
): Candidate {
  let score = 0;
  const reasons: string[] = [];
  
  const entityName = entity.labels?.en?.value || '';
  const entityWebsite = extractWebsite(entity);
  const entityDomain = normalizeDomain(entityWebsite);
  
  // 1. Domain match (+40 points) - highest weight
  if (brandDomain && entityDomain) {
    if (brandDomain === entityDomain) {
      score += 40;
      reasons.push('domain_exact_match');
    } else if (brandDomain.includes(entityDomain) || entityDomain.includes(brandDomain)) {
      score += 25;
      reasons.push('domain_partial_match');
    }
  }
  
  // 2. Name exact match (+25 points)
  const nameSimilarity = stringSimilarity(brandName, entityName);
  if (nameSimilarity === 1) {
    score += 25;
    reasons.push('name_exact_match');
  } else if (nameSimilarity >= 0.9) {
    score += 20;
    reasons.push('name_high_similarity');
  } else if (nameSimilarity >= 0.7) {
    score += 10;
    reasons.push('name_partial_match');
  }
  
  // 3. Name contains (+15 points)
  const brandLower = brandName.toLowerCase();
  const entityLower = entityName.toLowerCase();
  if (brandLower.includes(entityLower) || entityLower.includes(brandLower)) {
    if (!reasons.includes('name_exact_match') && !reasons.includes('name_high_similarity')) {
      score += 15;
      reasons.push('name_contains');
    }
  }
  
  // 4. Is valid company type (+10 points)
  if (isCompanyOrOrg(entity)) {
    score += 10;
    reasons.push('valid_entity_type');
  } else {
    score -= 20;
    reasons.push('invalid_entity_type');
  }
  
  // 5. Has description (+5 points)
  if (entity.descriptions?.en?.value) {
    score += 5;
    reasons.push('has_description');
  }
  
  return {
    candidate_qid: qid,
    candidate_name: entityName,
    candidate_domain: entityDomain,
    score: Math.max(0, score),
    reasons,
    source: 'wikidata'
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { brand_id, auto_apply = true } = await req.json();

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: 'brand_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch brand data
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, website, ticker, exchange, wikidata_qid, identity_confidence, status')
      .eq('id', brand_id)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found', details: brandError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verifying identity for brand: ${brand.name} (${brand.id})`);

    const brandDomain = normalizeDomain(brand.website);

    // Search Wikidata for candidates
    const searchResults = await searchWikidata(brand.name, 8);
    console.log(`Found ${searchResults.length} Wikidata candidates for "${brand.name}"`);

    // Score each candidate
    const candidates: Candidate[] = [];
    
    for (const result of searchResults) {
      const entity = await getWikidataEntity(result.id);
      if (!entity) continue;

      const candidate = scoreCandidate(
        brand.name,
        brandDomain,
        brand.ticker,
        entity,
        result.id
      );
      candidates.push(candidate);
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Delete old candidates and insert new ones
    await supabase
      .from('brand_identity_candidates')
      .delete()
      .eq('brand_id', brand_id);

    if (candidates.length > 0) {
      const { error: insertError } = await supabase
        .from('brand_identity_candidates')
        .insert(candidates.map(c => ({
          brand_id,
          candidate_qid: c.candidate_qid,
          candidate_name: c.candidate_name,
          candidate_domain: c.candidate_domain,
          score: c.score,
          reasons: c.reasons,
          source: c.source,
          is_selected: false
        })));

      if (insertError) {
        console.error('Failed to insert candidates:', insertError);
      }
    }

    // Check if we should auto-apply top candidate
    const topCandidate = candidates[0];
    let autoApplied = false;
    let newConfidence: string | null = null;

    if (auto_apply && topCandidate && topCandidate.score >= 70) {
      // Strong match - auto-apply
      const hasDomainMatch = topCandidate.reasons.includes('domain_exact_match');
      newConfidence = hasDomainMatch ? 'high' : 'medium';

      const { error: updateError } = await supabase
        .from('brands')
        .update({
          wikidata_qid: topCandidate.candidate_qid,
          identity_confidence: newConfidence,
          identity_notes: `Auto-verified: ${topCandidate.reasons.join(', ')}`,
          last_build_error: null,
          status: 'ready'
        })
        .eq('id', brand_id);

      if (!updateError) {
        autoApplied = true;
        console.log(`Auto-applied QID ${topCandidate.candidate_qid} with confidence ${newConfidence}`);

        // Mark this candidate as selected
        await supabase
          .from('brand_identity_candidates')
          .update({ is_selected: true })
          .eq('brand_id', brand_id)
          .eq('candidate_qid', topCandidate.candidate_qid);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        brand_id,
        brand_name: brand.name,
        candidates: candidates.slice(0, 5), // Return top 5
        auto_applied: autoApplied,
        new_confidence: newConfidence,
        top_score: topCandidate?.score || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('verify-brand-identity error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
