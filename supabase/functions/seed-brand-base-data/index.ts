/**
 * seed-brand-base-data
 * 
 * Creates the foundational data for a brand:
 * 1. Company record in `companies` table
 * 2. Ownership link in `company_ownership` table
 * 3. Placeholder shareholders (real data comes from SEC/other sources)
 * 
 * This replicates what was done manually for Walmart on Oct 22, 2025.
 * After this runs, `enrich-brand-wiki` can add key people and detailed data.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WikidataEntity {
  labels?: {
    en?: { value: string };
  };
  descriptions?: {
    en?: { value: string };
  };
  claims?: {
    P749?: Array<{  // parent organization
      mainsnak?: {
        datavalue?: {
          value?: { id: string };
        };
      };
    }>;
    P17?: Array<{  // country
      mainsnak?: {
        datavalue?: {
          value?: { id: string };
        };
      };
    }>;
  };
}

async function fetchWikidataEntity(qid: string): Promise<WikidataEntity> {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const response = await fetch(url);
  const data = await response.json();
  return data.entities[qid];
}

async function getCountryName(countryQid: string): Promise<string> {
  try {
    const entity = await fetchWikidataEntity(countryQid);
    return entity.labels?.en?.value || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { brand_id, wikidata_qid, brand_name } = await req.json();

    if (!brand_id || !wikidata_qid || !brand_name) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: brand_id, wikidata_qid, brand_name' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[seed-brand-base-data] Starting for:', { brand_id, wikidata_qid, brand_name });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch brand's Wikidata entity
    const brandEntity = await fetchWikidataEntity(wikidata_qid);
    
    // Get parent organization (P749) if exists
    const parentQid = brandEntity.claims?.P749?.[0]?.mainsnak?.datavalue?.value?.id;
    
    // If no parent, the brand IS the parent company (e.g., J&J, Apple, Walmart)
    const companyQid = parentQid || wikidata_qid;
    let companyName = brand_name;
    let companyDescription = brandEntity.descriptions?.en?.value;
    
    // If there's a parent, fetch its details
    if (parentQid) {
      const parentEntity = await fetchWikidataEntity(parentQid);
      companyName = parentEntity.labels?.en?.value || companyName;
      companyDescription = parentEntity.descriptions?.en?.value || companyDescription;
      console.log('[seed-brand-base-data] Found parent:', { parentQid, companyName });
    } else {
      console.log('[seed-brand-base-data] No parent - brand is the company');
    }

    // Get country
    const countryQid = brandEntity.claims?.P17?.[0]?.mainsnak?.datavalue?.value?.id;
    const country = countryQid ? await getCountryName(countryQid) : null;

    // 1. Create/update company record
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .upsert({
        name: companyName,
        wikidata_qid: companyQid,
        description: companyDescription,
        country: country,
        is_public: true,  // Most major brands are public
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'wikidata_qid'
      })
      .select()
      .single();

    if (companyError) {
      console.error('[seed-brand-base-data] Company creation failed:', companyError);
      throw companyError;
    }

    console.log('[seed-brand-base-data] Company created/updated:', company.id);

    // 2. Create ownership link
    const { error: ownershipError } = await supabase
      .from('company_ownership')
      .upsert({
        child_brand_id: brand_id,
        parent_company_id: company.id,
        parent_name: companyName,
        relationship: parentQid ? 'owned_by' : 'parent_organization',
        relationship_type: parentQid ? 'owned_by' : 'parent_organization',
        source: 'wikidata',
        confidence: 0.95,
        last_verified_at: new Date().toISOString()
      }, {
        onConflict: 'child_brand_id,parent_company_id'
      });

    if (ownershipError) {
      console.error('[seed-brand-base-data] Ownership creation failed:', ownershipError);
      throw ownershipError;
    }

    console.log('[seed-brand-base-data] Ownership link created');

    // STEP 4: Do NOT add placeholder shareholders
    // Only real SEC 13F data should be in company_shareholders
    // Placeholder data creates false information about who profits
    console.log('✅ Skipping placeholder shareholders (honesty over fake data)');

    return new Response(
      JSON.stringify({ 
        success: true,
        company_id: company.id,
        company_name: companyName,
        company_qid: companyQid,
        had_parent: !!parentQid,
        message: 'Base data seeded successfully. Run enrich-brand-wiki next to add key people and real shareholder data.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[seed-brand-base-data] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        success: false
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
