import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WIKIDATA_SPARQL = "https://query.wikidata.org/sparql";

interface WikidataResult {
  results: {
    bindings: Array<Record<string, { value: string; type: string }>>;
  };
}

async function querySparql(query: string): Promise<WikidataResult> {
  const response = await fetch(WIKIDATA_SPARQL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'BrandScan/1.0 (enrichment bot)',
      'Accept': 'application/json'
    },
    body: `query=${encodeURIComponent(query)}`
  });

  if (!response.ok) {
    throw new Error(`SPARQL query failed: ${response.statusText}`);
  }

  return await response.json();
}

function extractQid(uri: string): string {
  return uri.split('/').pop() || '';
}

function convertWikimediaImage(url: string): string {
  // Convert Wikimedia Commons URL to thumbnail
  const filename = url.split('/').pop();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}?width=200`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { brand_id } = await req.json();

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: "Missing brand_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-company] Starting enrichment for brand ${brand_id}`);

    // Get brand details
    const { data: brand, error: brandError } = await admin
      .from("brands")
      .select("id, name, wikidata_qid, parent_company")
      .eq("id", brand_id)
      .single();

    if (brandError || !brand) {
      throw new Error(`Brand not found: ${brandError?.message}`);
    }

    if (!brand.wikidata_qid) {
      console.log(`[enrich-company] No Wikidata QID for ${brand.name}, skipping`);
      return new Response(
        JSON.stringify({ success: true, message: "No Wikidata QID available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[enrich-company] Brand: ${brand.name}, QID: ${brand.wikidata_qid}`);

    // Query 1: Find parent company
    const parentQuery = `
      SELECT ?parent ?parentLabel ?rel WHERE {
        VALUES ?brand { wd:${brand.wikidata_qid} }
        OPTIONAL { ?brand wdt:P127 ?parent . BIND("owned_by" AS ?rel) }
        OPTIONAL { ?brand wdt:P176 ?parent . BIND("manufactured_by" AS ?rel) }
        OPTIONAL { ?brand wdt:P749 ?parent . BIND("parent_org" AS ?rel) }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
    `;

    const parentResult = await querySparql(parentQuery);
    const parentBindings = parentResult.results.bindings;

    if (parentBindings.length === 0) {
      console.log(`[enrich-company] No parent found for ${brand.name}`);
      return new Response(
        JSON.stringify({ success: true, message: "No parent company found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parentBinding = parentBindings[0];
    
    // Safety check: ensure required fields exist
    if (!parentBinding.parent?.value || !parentBinding.parentLabel?.value) {
      console.log(`[enrich-company] Invalid parent data for ${brand.name}`);
      return new Response(
        JSON.stringify({ success: true, message: "Invalid parent data structure" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const parentQid = extractQid(parentBinding.parent.value);
    const parentName = parentBinding.parentLabel.value;
    const relationship = parentBinding.rel?.value || 'related_to';

    console.log(`[enrich-company] Parent: ${parentName} (${parentQid}), rel: ${relationship}`);

    // Query 2: Get company details
    const companyQuery = `
      SELECT ?company ?companyLabel ?ticker ?exchangeLabel ?countryLabel ?article WHERE {
        VALUES ?company { wd:${parentQid} }
        OPTIONAL { ?company wdt:P249 ?ticker . }
        OPTIONAL { ?company wdt:P414 ?exchange . }
        OPTIONAL { ?company wdt:P17 ?country . }
        OPTIONAL {
          ?article schema:about ?company ;
                   schema:isPartOf <https://en.wikipedia.org/> ;
                   schema:name ?title .
        }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
    `;

    const companyResult = await querySparql(companyQuery);
    const companyBinding = companyResult.results.bindings[0] || {};

    const ticker = companyBinding.ticker?.value;
    const exchange = companyBinding.exchangeLabel?.value;
    const country = companyBinding.countryLabel?.value;
    const wikipediaTitle = companyBinding.article?.value?.split('/').pop();

    // Upsert company
    const { data: company, error: companyError } = await admin
      .from("companies")
      .upsert({
        wikidata_qid: parentQid,
        name: parentName,
        ticker: ticker,
        exchange: exchange,
        is_public: !!ticker,
        country: country,
        wikipedia_title: wikipediaTitle,
        description_source: wikipediaTitle ? 'wikipedia' : null,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'wikidata_qid'
      })
      .select()
      .single();

    if (companyError) {
      console.error(`[enrich-company] Company upsert error:`, companyError);
    }

    const companyId = company?.id;

    // Insert ownership link
    if (companyId) {
      await admin
        .from("company_ownership")
        .upsert({
          child_brand_id: brand_id,
          parent_company_id: companyId,
          parent_name: parentName,
          relationship: relationship,
          source: 'wikidata',
          source_ref: parentQid,
          confidence: relationship === 'parent_org' ? 0.95 : 0.85,
          last_verified_at: new Date().toISOString()
        }, {
          onConflict: 'child_brand_id,parent_name'
        });
    }

    // Query 3: Get key people
    const peopleQuery = `
      SELECT ?role ?person ?personLabel ?image WHERE {
        VALUES ?company { wd:${parentQid} }
        { ?company wdt:P169 ?person . BIND("chief_executive_officer" AS ?role) }
        UNION
        { ?company wdt:P488 ?person . BIND("chairperson" AS ?role) }
        UNION
        { ?company wdt:P112 ?person . BIND("founder" AS ?role) }
        OPTIONAL { ?person wdt:P18 ?image }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
      }
      LIMIT 10
    `;

    const peopleResult = await querySparql(peopleQuery);
    
    for (const binding of peopleResult.results.bindings) {
      // Safety checks for required fields
      if (!binding.person?.value || !binding.role?.value || !binding.personLabel?.value) {
        console.log(`[enrich-company] Skipping invalid person binding`);
        continue;
      }

      const personQid = extractQid(binding.person.value);
      const imageUrl = binding.image?.value ? convertWikimediaImage(binding.image.value) : null;

      if (companyId) {
        await admin
          .from("company_people")
          .upsert({
            company_id: companyId,
            role: binding.role.value,
            person_name: binding.personLabel.value,
            person_qid: personQid,
            image_url: imageUrl,
            source: 'wikidata',
            source_ref: personQid,
            last_verified_at: new Date().toISOString()
          }, {
            onConflict: 'company_id,role,person_name'
          });
      }
    }

    // Query 4: Get market cap (if public)
    if (ticker && companyId) {
      const valuationQuery = `
        SELECT ?amount ?currencyLabel ?date WHERE {
          VALUES ?company { wd:${parentQid} }
          ?company p:P2225 ?stmt .
          ?stmt ps:P2225 ?amount ;
                pq:P585 ?date .
          OPTIONAL { ?stmt pq:P2237 ?currency . }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        ORDER BY DESC(?date)
        LIMIT 1
      `;

      try {
        const valuationResult = await querySparql(valuationQuery);
        const valuationBinding = valuationResult.results.bindings[0];

        // Safety check for required valuation fields
        if (valuationBinding?.amount?.value && valuationBinding?.date?.value) {
          await admin
            .from("company_valuation")
            .insert({
              company_id: companyId,
              metric: 'market_cap',
              currency: valuationBinding.currencyLabel?.value || 'USD',
              value_numeric: parseFloat(valuationBinding.amount.value),
              as_of_date: valuationBinding.date.value.split('T')[0],
              source: 'wikidata',
              source_ref: parentQid
            });
        }
      } catch (e: any) {
        console.log(`[enrich-company] No valuation data: ${e?.message || String(e)}`);
      }
    }

    console.log(`[enrich-company] Enrichment complete for ${brand.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        brand_id,
        parent_company: parentName,
        company_id: companyId
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[enrich-company] Error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
