import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

interface KeyPerson {
  name: string;
  role: string;
  qid: string;
  imageFile?: string;
  imageUrl?: string;
  wikipediaTitle?: string;
}

// Role mapping: Wikidata property → DB enum value
const ROLE_PROPERTIES = [
  { prop: 'P169', role: 'chief_executive_officer' },
  { prop: 'P112', role: 'founder' },
  { prop: 'P488', role: 'chairperson' },
];

async function fetchKeyPeople(wikidataQid: string): Promise<KeyPerson[]> {
  const sparqlQuery = `
    SELECT ?person ?personLabel ?role ?image ?article WHERE {
      VALUES (?prop ?role) {
        ${ROLE_PROPERTIES.map(r => `(wd:${r.prop} "${r.role}")`).join('\n        ')}
      }
      wd:${wikidataQid} ?p ?statement .
      ?statement ?ps ?person .
      ?p wikibase:directClaim ?prop .
      OPTIONAL { ?person wdt:P18 ?image }
      OPTIONAL {
        ?article schema:about ?person .
        ?article schema:inLanguage "en" .
        ?article schema:isPartOf <https://en.wikipedia.org/> .
      }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }
  `;

  const response = await fetch(WIKIDATA_SPARQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Accept': 'application/sparql-results+json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `query=${encodeURIComponent(sparqlQuery)}`,
  });

  if (!response.ok) {
    throw new Error(`Wikidata SPARQL query failed: ${response.statusText}`);
  }

  const data = await response.json();
  const people: KeyPerson[] = [];

  for (const binding of data.results.bindings) {
    const personUri = binding.person.value;
    const qid = personUri.split('/').pop();
    const name = binding.personLabel.value;
    const role = binding.role.value;
    
    // Get Wikipedia URL (enwiki sitelink)
    let wikipediaTitle: string | undefined;
    if (binding.article?.value) {
      const url = binding.article.value;
      wikipediaTitle = url.split('/wiki/').pop();
    }
    
    // Convert Wikimedia Commons image to proper URLs
    let imageFile: string | undefined;
    let imageUrl: string | undefined;
    if (binding.image?.value) {
      const filename = binding.image.value.split('/').pop();
      imageFile = filename;
      imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=256`;
    }

    people.push({ name, role, qid, imageFile, imageUrl, wikipediaTitle });
  }

  return people;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();
  let companyId: string | null = null;
  let rowsWritten = 0;
  let status = 'success';
  let errorMsg: string | null = null;

  try {
    const { company_id, wikidata_qid } = await req.json();

    if (!company_id || !wikidata_qid) {
      return new Response(
        JSON.stringify({ error: 'Missing company_id or wikidata_qid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    companyId = company_id;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log(`[enrich-key-people] Fetching key people for ${wikidata_qid}`);

    // Fetch key people from Wikidata
    const people = await fetchKeyPeople(wikidata_qid);

    if (people.length === 0) {
      errorMsg = 'No key people found';
      status = 'partial';
      console.log('[enrich-key-people] No key people found');
    } else {
      // Insert/update people in database (idempotent)
      for (const person of people) {
        const wikipediaUrl = person.wikipediaTitle 
          ? `https://en.wikipedia.org/wiki/${person.wikipediaTitle}`
          : `https://en.wikipedia.org/wiki/${encodeURIComponent(person.name.replace(/ /g, '_'))}`;

        const { error: upsertError } = await supabase
          .from('company_people')
          .upsert({
            company_id,
            person_name: person.name,
            person_qid: person.qid,
            role: person.role,
            image_file: person.imageFile,
            image_url: person.imageUrl,
            wikipedia_url: wikipediaUrl,
            source_name: 'Wikidata',
            source_ref: `https://www.wikidata.org/wiki/${wikidata_qid}`,
            confidence: 0.90,
            last_verified_at: new Date().toISOString(),
          }, {
            onConflict: 'company_id,role',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error(`[enrich-key-people] Failed to upsert ${person.name}:`, upsertError);
          if (status === 'success') status = 'partial';
        } else {
          rowsWritten++;
          console.log(`[enrich-key-people] Added: ${person.name} (${person.role})`);
        }
      }
    }

    // Log enrichment run
    await supabase.from('enrichment_runs').insert({
      brand_id: null, // Key people are company-level, not brand-level
      task: 'key_people',
      rows_written: rowsWritten,
      status: rowsWritten > 0 ? 'success' : status,
      error: errorMsg,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startTime
    });

    return new Response(
      JSON.stringify({ 
        message: rowsWritten > 0 ? 'Key people enriched successfully' : 'No key people found', 
        count: rowsWritten,
        people: people.map(p => ({ name: p.name, role: p.role }))
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[enrich-key-people] Error:', error);
    
    // Log failed run
    if (companyId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        await supabase.from('enrichment_runs').insert({
          brand_id: null,
          task: 'key_people',
          rows_written: 0,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          started_at: new Date(startTime).toISOString(),
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startTime
        });
      } catch {}
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
