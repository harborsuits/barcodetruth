import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (...args: any[]) => console.log("[resolve-company-gleif]", ...args);

const GLEIF_API = "https://api.gleif.org/api/v1";

interface GleifEntity {
  lei: string;
  entity: {
    legalName: { name: string };
    legalAddress: { country: string; city: string; region?: string };
    jurisdiction: string;
    status: string;
    legalForm?: { id: string };
  };
}

interface GleifRelationship {
  type: string;
  startNode: { id: string };
  endNode: { id: string };
  relationship: {
    relationshipType: string;
    relationshipStatus: string;
    periods?: Array<{ startDate: string; endDate?: string }>;
  };
}

async function searchGleif(query: string, jurisdiction?: string): Promise<GleifEntity[]> {
  const params = new URLSearchParams({
    "filter[fulltext]": query,
    "page[size]": "5",
  });
  if (jurisdiction) params.set("filter[entity.jurisdiction]", jurisdiction);

  const url = `${GLEIF_API}/lei-records?${params}`;
  log("Searching GLEIF:", url);

  const res = await fetch(url, {
    headers: { Accept: "application/vnd.api+json" },
  });
  if (!res.ok) {
    log("GLEIF search failed:", res.status);
    return [];
  }
  const json = await res.json();
  return (json.data || []).map((d: any) => ({
    lei: d.attributes.lei,
    entity: d.attributes.entity,
  }));
}

async function getParentRelationships(lei: string): Promise<GleifRelationship[]> {
  const url = `${GLEIF_API}/lei-records/${lei}/direct-parent-relationship`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.api+json" },
  });
  if (!res.ok) return [];
  const json = await res.json();
  if (!json.data) return [];
  const items = Array.isArray(json.data) ? json.data : [json.data];
  return items.map((d: any) => ({
    type: d.type,
    startNode: d.attributes?.relationship?.startNode || { id: lei },
    endNode: d.attributes?.relationship?.endNode || { id: "" },
    relationship: d.attributes?.relationship || {},
  }));
}

async function getLeiRecord(lei: string): Promise<GleifEntity | null> {
  const url = `${GLEIF_API}/lei-records/${lei}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.api+json" },
  });
  if (!res.ok) return null;
  const json = await res.json();
  if (!json.data) return null;
  return {
    lei: json.data.attributes.lei,
    entity: json.data.attributes.entity,
  };
}

function normalizeDomain(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
      .replace(/^www\./, "")
      .toLowerCase();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_name, domain, jurisdiction, legal_name, company_id } = await req.json();

    if (!company_name && !legal_name) {
      return new Response(JSON.stringify({ error: "company_name or legal_name required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Search GLEIF by legal name first, then company name
    const searchTerm = legal_name || company_name;
    const results = await searchGleif(searchTerm, jurisdiction);

    if (results.length === 0) {
      log("No GLEIF results for:", searchTerm);
      return new Response(JSON.stringify({ matched: false, query: searchTerm }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Score matches
    const normalizedQuery = searchTerm.toLowerCase().trim();
    const normalizedDomain = normalizeDomain(domain);

    let bestMatch: GleifEntity | null = null;
    let bestScore = 0;

    for (const entity of results) {
      let score = 0;
      const legalName = entity.entity.legalName.name.toLowerCase();

      // Exact legal name match
      if (legalName === normalizedQuery) score += 100;
      // Contains match
      else if (legalName.includes(normalizedQuery) || normalizedQuery.includes(legalName)) score += 60;
      // Word overlap
      else {
        const queryWords = new Set(normalizedQuery.split(/\s+/));
        const nameWords = legalName.split(/\s+/);
        const overlap = nameWords.filter((w: string) => queryWords.has(w)).length;
        score += overlap * 15;
      }

      // Jurisdiction match bonus
      if (jurisdiction && entity.entity.jurisdiction?.toLowerCase() === jurisdiction.toLowerCase()) {
        score += 20;
      }

      // Active entity bonus
      if (entity.entity.status === "ACTIVE") score += 10;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = entity;
      }
    }

    if (!bestMatch || bestScore < 30) {
      log("No confident match. Best score:", bestScore);
      return new Response(JSON.stringify({ matched: false, best_score: bestScore, query: searchTerm }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Best match:", bestMatch.entity.legalName.name, "LEI:", bestMatch.lei, "score:", bestScore);

    // Upsert into company spine
    const spineData: Record<string, any> = {
      p_name: bestMatch.entity.legalName.name,
      p_lei: bestMatch.lei,
      p_jurisdiction: bestMatch.entity.jurisdiction || null,
      p_legal_name: bestMatch.entity.legalName.name,
    };

    if (normalizedDomain) spineData.p_domain = normalizedDomain;

    const { data: spineResult, error: spineError } = await supabase.rpc(
      "upsert_company_spine",
      spineData
    );

    if (spineError) {
      log("Spine upsert error:", spineError);
    } else {
      log("Spine upsert result:", spineResult);
    }

    // Fetch parent relationships from GLEIF
    const parentRels = await getParentRelationships(bestMatch.lei);
    const parentResults: any[] = [];

    for (const rel of parentRels) {
      const parentLei = rel.endNode?.id;
      if (!parentLei || parentLei === bestMatch.lei) continue;

      const parentEntity = await getLeiRecord(parentLei);
      if (!parentEntity) continue;

      // Upsert parent into spine
      const { data: parentSpine } = await supabase.rpc("upsert_company_spine", {
        p_name: parentEntity.entity.legalName.name,
        p_lei: parentEntity.lei,
        p_jurisdiction: parentEntity.entity.jurisdiction || null,
        p_legal_name: parentEntity.entity.legalName.name,
      });

      // Create ownership link with typed semantics
      if (company_id || spineResult) {
        const childId = company_id || spineResult;
        const isActive = rel.relationship?.relationshipStatus === "ACTIVE";

        // Determine role: GLEIF direct parent = legal_parent
        const role = isActive ? "legal_parent" : "historical_parent";
        const period = rel.relationship?.periods?.[0];

        const { error: ownershipError } = await supabase
          .from("company_ownership")
          .upsert(
            {
              child_company_id: childId,
              parent_company_id: parentSpine || null,
              parent_name: parentEntity.entity.legalName.name,
              relationship: "parent",
              relationship_type: "control",
              relationship_role: role,
              confidence: 0.85,
              source: "gleif",
              source_url: `https://search.gleif.org/#/record/${parentEntity.lei}`,
              effective_from: period?.startDate || null,
              effective_to: period?.endDate || null,
              is_current: isActive,
            },
            { onConflict: "child_company_id,parent_company_id", ignoreDuplicates: false }
          );

        if (ownershipError) {
          log("Ownership upsert error:", ownershipError);
        }

        parentResults.push({
          name: parentEntity.entity.legalName.name,
          lei: parentEntity.lei,
          role,
          is_active: isActive,
        });
      }
    }

    return new Response(
      JSON.stringify({
        matched: true,
        lei: bestMatch.lei,
        legal_name: bestMatch.entity.legalName.name,
        jurisdiction: bestMatch.entity.jurisdiction,
        status: bestMatch.entity.status,
        match_score: bestScore,
        parents: parentResults,
        spine_id: spineResult,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    log("Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
