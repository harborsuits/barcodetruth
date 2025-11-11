import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,content-type,x-internal-token,x-cron-token',
};

// Logging helpers
const log = (...args: any[]) => console.log('[enrich-brand-wiki]', ...args);
const warn = (...args: any[]) => console.warn('[enrich-brand-wiki]', ...args);
const err = (...args: any[]) => console.error('[enrich-brand-wiki]', ...args);

// Retry helper with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
  let lastError: Error | undefined;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timeout);
      
      if (res.status >= 500 || res.status === 429) {
        throw new Error(`HTTP_${res.status}`);
      }
      return res;
    } catch (err) {
      lastError = err as Error;
      if (i < maxRetries - 1) {
        const delay = Math.round((400 * Math.pow(2, i)) + Math.random() * 150);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error('Fetch failed');
}

// Reliable entity fetch that handles redirects/normalized QIDs
async function fetchWikidataEntity(qid: string) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const res = await fetchWithRetry(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`Entity fetch failed ${res.status} for ${qid}`);
  const json = await res.json();

  // Handle normalized redirects (common cause of "entity empty")
  const normalized = json?.entities;
  if (!normalized || !normalized[qid]) {
    const actualQid = Object.keys(normalized ?? {})[0];
    if (!actualQid) throw new Error(`No entity payload for ${qid}`);
    if (actualQid !== qid) log(`QID normalized: ${qid} -> ${actualQid}`);
    return { qid: actualQid, entity: normalized[actualQid] };
  }
  return { qid, entity: normalized[qid] };
}

const getLabel = (entity: any, lang = 'en') => entity?.labels?.[lang]?.value ?? null;
const getDesc = (entity: any, lang = 'en') => entity?.descriptions?.[lang]?.value ?? null;

function claimIds(entity: any, prop: string): string[] {
  return (entity?.claims?.[prop] ?? [])
    .map((c: any) => c?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

Deno.serve(async (req) => {
  console.log('[STEP 1] Function invoked');
  
  try {
    console.log('[STEP 2] Checking method:', req.method);
    if (req.method === 'OPTIONS') {
      console.log('[STEP 2a] CORS preflight - returning');
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    console.log('[STEP 3] Checking pathname');
    const { pathname } = new URL(req.url);
    if (pathname.endsWith('/health')) {
      console.log('[STEP 3a] Health check - returning');
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    console.log('[STEP 4] Creating Supabase client');
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    console.log('[STEP 4a] Supabase client created');

    // Parse parameters from JSON body or query params
    let brand_id: string | undefined;
    let wikidata_qid: string | undefined;
    let mode: string | undefined;

    console.log('[STEP 5] Parsing request body/params');
    if (req.method === 'POST') {
      console.log('[STEP 5a] POST request - parsing JSON body');
      const body = await req.json();
      console.log('[STEP 5b] Body parsed:', JSON.stringify(body));
      brand_id = body.brand_id;
      wikidata_qid = body.wikidata_qid;
      mode = body.mode;
    } else {
      console.log('[STEP 5c] GET request - parsing query params');
      const url = new URL(req.url);
      brand_id = url.searchParams.get('brand_id') || undefined;
      wikidata_qid = url.searchParams.get('wikidata_qid') || undefined;
      mode = url.searchParams.get('mode') || undefined;
    }

    console.log('[STEP 6] Extracted params:', { brand_id, wikidata_qid, mode });
    log('Parsed params:', { brand_id, wikidata_qid, mode });

    // Validate required parameters
    console.log('[STEP 7] Validating brand_id');
    if (!brand_id) {
      console.log('[STEP 7a] ERROR: Missing brand_id');
      err('Missing required parameter: brand_id', { received: { brand_id, wikidata_qid, mode } });
      return new Response(
        JSON.stringify({ 
          ok: false,
          error: 'Missing required parameter: brand_id',
          received: { brand_id, wikidata_qid, mode }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    console.log('[STEP 7b] brand_id validated:', brand_id);

    // Fetch brand info
    console.log('[STEP 8] Fetching brand from database');
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brand_id)
      .maybeSingle();

    console.log('[STEP 8a] Database query completed');
    if (brandError) {
      console.log('[STEP 8b] ERROR: Database error:', brandError);
      err('Database error fetching brand:', brandError);
      throw new Error(`Database error: ${brandError.message}`);
    }
    
    console.log('[STEP 8c] Brand data received:', brand ? 'Yes' : 'No');
    if (!brand) {
      console.log('[STEP 8d] ERROR: Brand not found');
      err('Brand not found:', { brand_id });
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Brand not found in database',
          reason: 'brand_not_found',
          brand_id 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    console.log('[STEP 8e] Brand found:', brand.name);

    // Validate brand has a name
    if (!brand.name || brand.name.trim() === '') {
      err('Brand has no name:', { brand_id, name: brand.name });
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Brand must have a name before enrichment',
          reason: 'empty_name'
        }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Skip enrichment for placeholder brands
    if (brand.name.toLowerCase().includes('unnamed') || 
        brand.name.toLowerCase().includes('placeholder')) {
      log('Skipping enrichment for placeholder brand:', brand.name);
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: 'Cannot enrich placeholder brands',
          reason: 'placeholder_name'
        }),
        { 
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 1: Resolve or search for QID with entity type validation
    console.log('[STEP 9] Resolving Wikidata QID');
    let qid = wikidata_qid ?? brand.wikidata_qid;
    console.log('[STEP 9a] QID from params or brand:', qid);
    
    if (!qid) {
      console.log('[STEP 10] No QID found, searching Wikidata');
      log('No QID, searching Wikidata for', brand.name);
      
      // Enhanced search: exclude sports suffixes
      const cleanName = brand.name
        .replace(/\s+(FC|SC|CF|United|City|Town)$/i, '') // Remove sports suffixes
        .trim();
      
      console.log('[STEP 10a] Cleaned brand name:', cleanName);
      
      // Search with increased limit to find more candidates (search brand name directly)
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleanName)}&language=en&format=json&type=item&limit=20`;
      console.log('[STEP 10b] Calling Wikidata search API');
      const searchRes = await fetchWithRetry(searchUrl);
      console.log('[STEP 10c] Wikidata search response received:', searchRes.status);
      const searchData = await searchRes.json();
      console.log('[STEP 10d] Search data parsed, candidates:', searchData.search?.length || 0);
      
      log(`Found ${searchData.search?.length || 0} candidates for "${cleanName}"`);
      
      let potentialMatch: any = null;
      
      // Validate each candidate by checking entity type (P31)
      for (const candidate of searchData.search || []) {
        try {
          const { entity } = await fetchWikidataEntity(candidate.id);
          const instanceOf = claimIds(entity, 'P31'); // P31 = instance of
          
          log(`Checking ${candidate.id} (${candidate.label}):`, instanceOf);
          
          // Expanded valid company types
          const COMPANY_TYPES = [
            'Q4830453',   // business
            'Q783794',    // company
            'Q431289',    // brand
            'Q43229',     // organization
            'Q6881511',   // enterprise
            'Q891723',    // public company
            'Q167037',    // corporation
            'Q1616075',   // business enterprise
            'Q2659904',   // government organization
            'Q46970',     // airline (ADDED for Delta, etc.)
            'Q507619',    // retailer
            'Q155076',    // subsidiary
            'Q1539532',   // conglomerate
            'Q166280',    // international company
            'Q1058914',   // software company
            'Q1616075',   // technology company
            'Q15711870',  // organization
            'Q13226383',  // facility operator
          ];
          
          // Expanded rejected types
          const REJECTED_TYPES = [
            'Q16510064',  // sports event
            'Q27020041',  // sports season
            'Q215380',    // musical group/band
            'Q5',         // human
            'Q482994',    // album
            'Q12323',     // Greek letter
            'Q102538',    // military unit
            'Q176799',    // military organization
            'Q8502',      // mountain
            'Q4022',      // river
            'Q16334295',  // group
            'Q105985',    // scout association
          ];
          
          const hasCompanyType = instanceOf.some(type => COMPANY_TYPES.includes(type));
          const hasRejectedType = instanceOf.some(type => REJECTED_TYPES.includes(type));
          
          // Reject if has invalid type
          if (hasRejectedType) {
            warn(`Rejected ${candidate.id} (invalid type:`, instanceOf, ')');
            continue;
          }
          
          // Accept if has valid company type
          if (hasCompanyType) {
            qid = candidate.id;
            log(`✓ Accepted ${candidate.id} (valid company type:`, instanceOf, ')');
            break;
          }
          
          // If no types match either list, save as potential match
          // (Not explicitly invalid, could be a valid company with missing type data)
          if (!potentialMatch && instanceOf.length === 0) {
            log(`Potential match ${candidate.id} (no type data)`);
            potentialMatch = candidate;
          }
        } catch (e) {
          warn('Failed to validate candidate', candidate.id, (e as Error).message);
        }
      }
      
      // Use potential match if we found one but no explicit valid match
      if (!qid && potentialMatch) {
        qid = potentialMatch.id;
        log(`Using potential match ${qid} (no invalid types found)`);
      }
      
      if (!qid) {
        log('No valid business entity found in Wikidata for:', cleanName);
        
        // Return success but indicate no entity found (don't crash UI)
        return new Response(
          JSON.stringify({ 
            ok: true,
            success: false,
            wikidata_found: false,
            message: `No Wikidata entity found for "${cleanName}"`,
            brand_name: brand.name
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Step 2: Fetch brand entity
    console.log('[STEP 11] Fetching Wikidata entity for QID:', qid);
    const { qid: brandQid, entity: brandEntity } = await fetchWikidataEntity(qid);
    console.log('[STEP 11a] Brand entity fetched successfully:', brandQid);
    log('Brand entity fetched', brandQid);

    const result: any = {
      success: true,
      wikidata_qid: brandQid,
      updated: false
    };

    // Step 3: Update description if needed
    console.log('[STEP 12] Checking for Wikipedia description');
    const wikiEnTitle = brandEntity?.sitelinks?.enwiki?.title;
    result.wiki_en_title = wikiEnTitle;
    console.log('[STEP 12a] Wikipedia title:', wikiEnTitle);

    if (wikiEnTitle && brand.description_source !== 'wikipedia') {
      console.log('[STEP 12b] Fetching Wikipedia extract');
      log('Fetching Wikipedia extract');
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(wikiEnTitle)}&format=json`;
      const wikiRes = await fetchWithRetry(wikiUrl);
      console.log('[STEP 12c] Wikipedia response received');
      const wikiData = await wikiRes.json();
      console.log('[STEP 12d] Wikipedia data parsed');
      
      const pages = wikiData.query?.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId]?.extract;
      console.log('[STEP 12e] Extract found:', extract ? 'Yes' : 'No');

      if (extract) {
        console.log('[STEP 12f] Updating brand description in database');
        await supabase
          .from('brands')
          .update({
            description: extract,
            description_source: 'wikipedia',
            wikidata_qid: brandQid
          })
          .eq('id', brand_id);
        
        result.updated = true;
        result.description_updated = true;
        console.log('[STEP 12g] Description updated successfully');
        log('Description updated from Wikipedia');
      }
    } else {
      console.log('[STEP 12h] Updating QID only');
      // Update QID even if description not updated
      await supabase
        .from('brands')
        .update({ wikidata_qid: brandQid })
        .eq('id', brand_id);
      console.log('[STEP 12i] QID updated');
    }

    // Step 4: FULL mode - ownership + key people + shareholders
    console.log('[STEP 13] Checking if mode is full:', mode);
    if (mode === 'full') {
      console.log('[STEP 13a] Starting FULL enrichment');
      log('Starting FULL enrichment');
      
      try {
        console.log('[STEP 13b] Calling resolve_company_for_brand RPC');
        // Resolve target company using new RPC
        const { data: resolvedCompanyId, error: resolveError } = await supabase
          .rpc('resolve_company_for_brand', { p_brand_id: brand_id });
        
        console.log('[STEP 13c] RPC result:', { resolvedCompanyId, error: resolveError });
        if (resolveError || !resolvedCompanyId) {
          console.log('[STEP 13d] ERROR: No company_id resolved');
          throw new Error('No company_id resolved for brand; cannot enrich people/shareholders');
        }
        
        const companyId = resolvedCompanyId as string;
        console.log('[STEP 13e] Company ID resolved:', companyId);
        log('Resolved company_id', companyId);

        // Find parent company QID (P749 = parent organization, P127 = owned by)
        const parentQids = claimIds(brandEntity, 'P749');
        const ownedByQids = claimIds(brandEntity, 'P127');
        
        // Use parent org first, then owned by, but DON'T fall back to brand itself
        let targetQid: string | null = null;
        let isParentRelation = false;
        
        if (parentQids.length > 0) {
          targetQid = parentQids[0];
          isParentRelation = true;
          log('Found parent org (P749):', targetQid);
        } else if (ownedByQids.length > 0) {
          targetQid = ownedByQids[0];
          isParentRelation = false;
          log('Found owner (P127):', targetQid);
        } else {
          // No parent/owner found - use brand entity for people/shareholders only
          targetQid = brandQid;
          isParentRelation = false;
          log('No parent found, using brand entity for people extraction only');
        }
        
        const { qid: companyQid, entity: companyEntity } = await fetchWikidataEntity(targetQid);
        log('Company entity fetched', companyQid);

        // Only update companies table if we found an actual parent (not self)
        if (companyQid !== brandQid) {
          await supabase
            .from('companies')
            .upsert({
              id: companyId,
              wikidata_qid: companyQid,
              name: getLabel(companyEntity),
              description: getDesc(companyEntity)
            }, { onConflict: 'id' });
          
          log('Parent company row upserted');
        } else {
          log('Skipping self-referential company record');
        }

        // === EXTRACT PEOPLE ===
        const CEO_QIDS = claimIds(companyEntity, 'P169');
        const CHAIR_QIDS = claimIds(companyEntity, 'P488');
        const FOUNDER_QIDS = claimIds(companyEntity, 'P112');

        const extractPeople = async (qids: string[], role: string, limit = 2) => {
          // De-duplicate while preserving order
          const seen = new Set<string>();
          const uniqueQids = qids.filter((q) => {
            if (seen.has(q)) return false;
            seen.add(q);
            return true;
          });

          for (const pqid of uniqueQids.slice(0, limit)) {
            try {
              const { entity: personEnt } = await fetchWikidataEntity(pqid);
              const personName = getLabel(personEnt);
              const imageClaim = personEnt?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;

              const { error: upsertErr } = await supabase.from('company_people').upsert({
                company_id: companyId,
                person_qid: pqid,
                person_name: personName,
                role,
                image_url: imageClaim ? `https://commons.wikimedia.org/wiki/Special:FilePath/${imageClaim}` : null,
                source: 'wikidata',
                last_verified_at: new Date().toISOString()
              }, { onConflict: 'company_id,person_qid,role' });

              if (upsertErr) throw upsertErr;

              log('Upserted person', { pqid, personName, role });
              await new Promise(r => setTimeout(r, 150));
            } catch (e) {
              warn('Person fetch/upsert failed', pqid, (e as Error).message);
            }
          }
        };

        log('Extracting people for company', companyQid);
        // Fallback to brand-level claims if company entity lacks people
        const BRAND_CEO_QIDS = claimIds(brandEntity, 'P169');
        const BRAND_CHAIR_QIDS = claimIds(brandEntity, 'P488');
        const BRAND_FOUNDER_QIDS = claimIds(brandEntity, 'P112');

        const ceoList = CEO_QIDS.length ? CEO_QIDS : BRAND_CEO_QIDS;
        const chairList = CHAIR_QIDS.length ? CHAIR_QIDS : BRAND_CHAIR_QIDS;
        const founderList = FOUNDER_QIDS.length ? FOUNDER_QIDS : BRAND_FOUNDER_QIDS;

        await extractPeople(ceoList, 'chief_executive_officer');
        await extractPeople(chairList, 'chairperson');
        await extractPeople(founderList, 'founder');

        // === EXTRACT SHAREHOLDERS (P127 'owned by') ===
        const OWNER_QIDS = claimIds(companyEntity, 'P127');
        log('Extracting shareholders', OWNER_QIDS.length, 'found');
        
        for (const oqid of OWNER_QIDS.slice(0, 6)) {
          try {
            const { entity: ownerEnt } = await fetchWikidataEntity(oqid);
            const holderName = getLabel(ownerEnt);
            
            await supabase.from('company_shareholders').upsert({
              company_id: companyId,
              holder_name: holderName,
              holder_type: 'institution',
              percent_owned: null,
              shares_owned: null,
              as_of: null,
              source: 'wikidata',
              last_updated: new Date().toISOString(),
              is_asset_manager: false,
              holder_wikidata_qid: oqid,
              data_source: 'wikidata'
            }, { onConflict: 'company_id,holder_name' });
            
            log('Upserted shareholder', holderName);
            await new Promise(r => setTimeout(r, 120));
          } catch (e) {
            warn('Shareholder fetch/upsert failed', oqid, (e as Error).message);
          }
        }

        result.full_enrichment_completed = true;
        log('Full enrichment completed', { brand_id, company_id: companyId });
        
      } catch (fullError) {
        err('Full enrichment error', { brand_id, error: (fullError as Error).message });
        result.full_enrichment_error = (fullError as Error).message;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[STEP ERROR] Function crashed:', error);
    console.error('[STEP ERROR] Error message:', error instanceof Error ? error.message : 'Unknown');
    console.error('[STEP ERROR] Error stack:', error instanceof Error ? error.stack : 'No stack');
    err('Error in enrich-brand-wiki:', error);
    return new Response(JSON.stringify({ 
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      message: 'Function crashed - check logs for [STEP X] to see where it failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
