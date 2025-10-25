import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Logging helpers
const log = (...args: any[]) => console.log('[enrich-brand-wiki]', ...args);
const warn = (...args: any[]) => console.warn('[enrich-brand-wiki]', ...args);
const err = (...args: any[]) => console.error('[enrich-brand-wiki]', ...args);

// Reliable entity fetch that handles redirects/normalized QIDs
async function fetchWikidataEntity(qid: string) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { brand_id, wikidata_qid, mode } = await req.json();
    log('Start', { brand_id, mode });

    // Fetch brand info
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('*')
      .eq('id', brand_id)
      .single();

    if (brandError || !brand) {
      throw new Error('Brand not found');
    }

    // Step 1: Resolve or search for QID with entity type validation
    let qid = wikidata_qid ?? brand.wikidata_qid;
    
    if (!qid) {
      log('No QID, searching Wikidata for', brand.name);
      
      // Enhanced search: prefer company-related terms, exclude sports
      const cleanName = brand.name
        .replace(/\s+(FC|SC|CF|United|City|Town)$/i, '') // Remove sports suffixes
        .trim();
      
      const searchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(cleanName + ' company')}&language=en&format=json&type=item&limit=5`;
      const searchRes = await fetch(searchUrl);
      const searchData = await searchRes.json();
      
      // Validate each candidate by checking entity type (P31)
      for (const candidate of searchData.search || []) {
        try {
          const { entity } = await fetchWikidataEntity(candidate.id);
          const instanceOf = claimIds(entity, 'P31'); // P31 = instance of
          
          // Accepted entity types
          const COMPANY_TYPES = [
            'Q4830453',  // business
            'Q783794',   // company
            'Q431289',   // brand
            'Q43229',    // organization
            'Q6881511',  // enterprise
            'Q891723',   // public company
            'Q167037',   // corporation
            'Q1616075',  // business enterprise
            'Q2659904',  // government organization
          ];
          
          // Rejected entity types (sports-related)
          const REJECTED_TYPES = [
            'Q16510064', // sports event
            'Q27020041', // sports season
            'Q215380',   // musical group/band
            'Q5',        // human
            'Q482994',   // album
          ];
          
          const hasCompanyType = instanceOf.some(type => COMPANY_TYPES.includes(type));
          const hasRejectedType = instanceOf.some(type => REJECTED_TYPES.includes(type));
          
          if (hasCompanyType && !hasRejectedType) {
            qid = candidate.id;
            log('Found valid company QID:', qid, 'types:', instanceOf);
            break;
          } else {
            warn('Rejected QID', candidate.id, 'types:', instanceOf);
          }
        } catch (e) {
          warn('Failed to validate candidate', candidate.id, (e as Error).message);
        }
      }
      
      if (!qid) {
        throw new Error('Could not find valid company entity in Wikidata');
      }
    }

    // Step 2: Fetch brand entity
    const { qid: brandQid, entity: brandEntity } = await fetchWikidataEntity(qid);
    log('Brand entity fetched', brandQid);

    const result: any = {
      success: true,
      wikidata_qid: brandQid,
      updated: false
    };

    // Step 3: Update description if needed
    const wikiEnTitle = brandEntity?.sitelinks?.enwiki?.title;
    result.wiki_en_title = wikiEnTitle;

    if (wikiEnTitle && brand.description_source !== 'wikipedia') {
      log('Fetching Wikipedia extract');
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(wikiEnTitle)}&format=json`;
      const wikiRes = await fetch(wikiUrl);
      const wikiData = await wikiRes.json();
      
      const pages = wikiData.query?.pages;
      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId]?.extract;

      if (extract) {
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
        log('Description updated from Wikipedia');
      }
    } else {
      // Update QID even if description not updated
      await supabase
        .from('brands')
        .update({ wikidata_qid: brandQid })
        .eq('id', brand_id);
    }

    // Step 4: FULL mode - ownership + key people + shareholders
    if (mode === 'full') {
      log('Starting FULL enrichment');
      
      try {
        // Resolve target company using new RPC
        const { data: resolvedCompanyId, error: resolveError } = await supabase
          .rpc('resolve_company_for_brand', { p_brand_id: brand_id });
        
        if (resolveError || !resolvedCompanyId) {
          throw new Error('No company_id resolved for brand; cannot enrich people/shareholders');
        }
        
        const companyId = resolvedCompanyId as string;
        log('Resolved company_id', companyId);

        // Find parent company QID (P749) OR use brandQid if brand is itself the company
        const parentQids = claimIds(brandEntity, 'P749');
        const targetQid = parentQids[0] ?? brandQid;
        
        const { qid: companyQid, entity: companyEntity } = await fetchWikidataEntity(targetQid);
        log('Company entity fetched', companyQid);

        // Update companies row with basic facts
        await supabase
          .from('companies')
          .upsert({
            id: companyId,
            wikidata_qid: companyQid,
            name: getLabel(companyEntity),
            description: getDesc(companyEntity)
          }, { onConflict: 'id' });
        
        log('Company row upserted');

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
    err('Error in enrich-brand-wiki:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
