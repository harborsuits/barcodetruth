import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql';

interface KeyPerson {
  name: string;
  role: string;
  qid: string;
  imageUrl?: string;
}

// Role mapping: Wikidata property → human-readable label
const ROLE_PROPERTIES = [
  { prop: 'P169', role: 'chief_executive_officer' },
  { prop: 'P112', role: 'founder' },
  { prop: 'P488', role: 'chairperson' },
];

async function fetchKeyPeople(wikidataQid: string): Promise<KeyPerson[]> {
  const sparqlQuery = `
    SELECT ?person ?personLabel ?role ?image WHERE {
      VALUES (?prop ?role) {
        ${ROLE_PROPERTIES.map(r => `(wd:${r.prop} "${r.role}")`).join('\n        ')}
      }
      wd:${wikidataQid} ?p ?statement .
      ?statement ?ps ?person .
      ?p wikibase:directClaim ?prop .
      OPTIONAL { ?person wdt:P18 ?image }
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
    
    // Convert Wikimedia Commons image to proper URL
    let imageUrl: string | undefined;
    if (binding.image?.value) {
      const filename = binding.image.value.split('/').pop();
      imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=256`;
    }

    people.push({ name, role, qid, imageUrl });
  }

  return people;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { company_id, wikidata_qid } = await req.json();

    if (!company_id || !wikidata_qid) {
      return new Response(
        JSON.stringify({ error: 'Missing company_id or wikidata_qid' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch key people from Wikidata
    const people = await fetchKeyPeople(wikidata_qid);

    if (people.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No key people found', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert/update people in database
    const inserts = people.map(p => ({
      company_id,
      person_name: p.name,
      person_qid: p.qid,
      role: p.role,
      image_url: p.imageUrl,
      source: 'wikidata',
      source_ref: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.name.replace(/ /g, '_'))}`,
      confidence: 0.85,
      last_verified_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabase
      .from('company_people')
      .upsert(inserts, {
        onConflict: 'company_id,person_name,role',
      });

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        message: 'Key people enriched successfully', 
        count: people.length,
        people: people.map(p => ({ name: p.name, role: p.role }))
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error enriching key people:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
