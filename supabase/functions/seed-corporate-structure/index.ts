import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (...args: any[]) => console.log("[seed-corporate-structure]", ...args);
const warn = (...args: any[]) => console.warn("[seed-corporate-structure]", ...args);

// Retry helper
async function fetchRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 10000);
      const res = await fetch(url, { signal: c.signal, headers: { Accept: "application/json" } });
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP_${res.status}`);
      return res;
    } catch (e) {
      if (i < retries - 1) await new Promise(r => setTimeout(r, 500 * Math.pow(2, i)));
      else throw e;
    }
  }
  throw new Error("fetch failed");
}

// Wikidata helpers
async function getEntity(qid: string) {
  const res = await fetchRetry(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  if (!res.ok) throw new Error(`Entity fetch ${res.status} for ${qid}`);
  const json = await res.json();
  const entities = json?.entities ?? {};
  const key = Object.keys(entities)[0];
  return { qid: key ?? qid, entity: entities[key] };
}

const label = (e: any, l = "en") => e?.labels?.[l]?.value ?? null;
const desc = (e: any, l = "en") => e?.descriptions?.[l]?.value ?? null;

function claimIds(entity: any, prop: string): string[] {
  return (entity?.claims?.[prop] ?? [])
    .map((c: any) => c?.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

function claimStrings(entity: any, prop: string): string[] {
  return (entity?.claims?.[prop] ?? [])
    .map((c: any) => c?.mainsnak?.datavalue?.value)
    .filter((v: any) => typeof v === "string");
}

// Wikidata properties
// P749 = parent organization, P127 = owned by
// P355 = has subsidiary, P1830 = owner of
// P169 = CEO, P488 = chair, P112 = founder
// P414 = stock exchange, P249 = ticker symbol
// P856 = official website, P17 = country

interface DiscoveredEntity {
  qid: string;
  name: string;
  description: string | null;
  ticker: string | null;
  exchange_qid: string | null;
  country_qid: string | null;
  is_public: boolean;
  logo_url: string | null;
  website: string | null;
  parent_qids: string[];
  subsidiary_qids: string[];
}

async function discoverEntity(qid: string): Promise<DiscoveredEntity | null> {
  try {
    const { qid: resolvedQid, entity } = await getEntity(qid);
    if (!entity) return null;

    const name = label(entity);
    if (!name) return null;

    const tickerArr = claimStrings(entity, "P249");
    const exchangeArr = claimIds(entity, "P414");
    const countryArr = claimIds(entity, "P17");
    const websites = claimStrings(entity, "P856");
    const parentQids = [...claimIds(entity, "P749"), ...claimIds(entity, "P127")];
    const subsidiaryQids = [...claimIds(entity, "P355"), ...claimIds(entity, "P1830")];

    // Logo from P154 (logo image)
    const logoClaim = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
    const logo_url = logoClaim
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(logoClaim)}`
      : null;

    return {
      qid: resolvedQid,
      name,
      description: desc(entity),
      ticker: tickerArr[0] ?? null,
      exchange_qid: exchangeArr[0] ?? null,
      country_qid: countryArr[0] ?? null,
      is_public: tickerArr.length > 0 || exchangeArr.length > 0,
      logo_url,
      website: websites[0] ?? null,
      parent_qids: [...new Set(parentQids)],
      subsidiary_qids: [...new Set(subsidiaryQids)],
    };
  } catch (e) {
    warn("Failed to discover entity", qid, (e as Error).message);
    return null;
  }
}

// Resolve exchange QID to human-readable name
const EXCHANGE_MAP: Record<string, string> = {
  Q13677: "NYSE",
  Q82059: "NASDAQ",
  Q171240: "LSE",
  Q217475: "Euronext",
  Q808936: "TSX",
  Q549981: "ASX",
  Q217230: "SIX",
  Q485718: "HKEX",
  Q1055279: "TSE",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const { brand_id, limit = 10, dry_run = false } = body;

    // Mode 1: Single brand — build full corporate tree
    // Mode 2: Batch — process N brands that have QIDs but no company_ownership rows
    const brandIds: string[] = [];

    if (brand_id) {
      brandIds.push(brand_id);
    } else {
      // Find brands with QIDs but missing corporate structure
      const { data: brands } = await supabase
        .from("brands")
        .select("id, name, wikidata_qid")
        .not("wikidata_qid", "is", null)
        .order("name")
        .limit(limit);

      if (!brands?.length) {
        return new Response(
          JSON.stringify({ ok: true, message: "No brands with QIDs found", processed: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Filter to brands without company_ownership rows
      for (const b of brands) {
        const { count } = await supabase
          .from("company_ownership")
          .select("id", { count: "exact", head: true })
          .eq("child_brand_id", b.id);
        if ((count ?? 0) === 0) brandIds.push(b.id);
      }
    }

    log(`Processing ${brandIds.length} brands (dry_run=${dry_run})`);

    const results: any[] = [];

    for (const bid of brandIds) {
      try {
        const { data: brand } = await supabase
          .from("brands")
          .select("id, name, wikidata_qid")
          .eq("id", bid)
          .maybeSingle();

        if (!brand?.wikidata_qid) {
          results.push({ brand_id: bid, status: "skipped", reason: "no_qid" });
          continue;
        }

        log(`Processing ${brand.name} (${brand.wikidata_qid})`);

        // Step 1: Discover the brand entity
        const brandEntity = await discoverEntity(brand.wikidata_qid);
        if (!brandEntity) {
          results.push({ brand_id: bid, name: brand.name, status: "skipped", reason: "entity_not_found" });
          continue;
        }

        // Step 2: Walk UP the ownership chain to find ultimate parent
        const chain: DiscoveredEntity[] = [brandEntity];
        const visited = new Set<string>([brandEntity.qid]);
        let current = brandEntity;
        let ultimateParent: DiscoveredEntity | null = null;

        while (current.parent_qids.length > 0) {
          const nextQid = current.parent_qids[0]; // Follow first parent
          if (visited.has(nextQid)) break; // Prevent loops
          visited.add(nextQid);

          const parent = await discoverEntity(nextQid);
          if (!parent) break;

          chain.push(parent);
          ultimateParent = parent;
          current = parent;

          // Safety: max 5 levels deep
          if (chain.length > 5) break;
          await new Promise(r => setTimeout(r, 300)); // Rate limit
        }

        // Step 3: Get subsidiaries of the ultimate parent (sister brands)
        const topEntity = ultimateParent ?? brandEntity;
        const sisterBrands: DiscoveredEntity[] = [];

        for (const subQid of topEntity.subsidiary_qids.slice(0, 20)) {
          if (visited.has(subQid)) continue;
          visited.add(subQid);

          const sub = await discoverEntity(subQid);
          if (sub) sisterBrands.push(sub);
          await new Promise(r => setTimeout(r, 300));
        }

        if (dry_run) {
          results.push({
            brand_id: bid,
            name: brand.name,
            status: "dry_run",
            chain: chain.map(e => ({ qid: e.qid, name: e.name })),
            ultimate_parent: ultimateParent ? { qid: ultimateParent.qid, name: ultimateParent.name } : null,
            sister_brands: sisterBrands.map(e => ({ qid: e.qid, name: e.name })),
          });
          continue;
        }

        // Step 4: Persist — upsert companies for each entity in the chain
        let parentCompanyId: string | null = null;

        if (ultimateParent) {
          // Upsert ultimate parent as a company
          const { data: companyRow } = await supabase
            .from("companies")
            .upsert(
              {
                wikidata_qid: ultimateParent.qid,
                name: ultimateParent.name,
                description: ultimateParent.description,
                ticker: ultimateParent.ticker,
                exchange: ultimateParent.exchange_qid ? EXCHANGE_MAP[ultimateParent.exchange_qid] ?? null : null,
                is_public: ultimateParent.is_public,
                logo_url: ultimateParent.logo_url,
              },
              { onConflict: "wikidata_qid", ignoreDuplicates: false }
            )
            .select("id")
            .maybeSingle();

          parentCompanyId = companyRow?.id ?? null;
          log(`Upserted parent company: ${ultimateParent.name} (${parentCompanyId})`);
        }

        // Step 5: Create company_ownership link
        if (parentCompanyId) {
          await supabase.from("company_ownership").upsert(
            {
              child_brand_id: bid,
              parent_company_id: parentCompanyId,
              parent_name: ultimateParent!.name,
              relationship: "subsidiary",
              relationship_type: "parent",
              source: "wikidata",
              source_ref: `https://www.wikidata.org/wiki/${ultimateParent!.qid}`,
              confidence: 0.85,
              is_validated: true,
              last_verified_at: new Date().toISOString(),
            },
            { onConflict: "child_brand_id,parent_company_id" }
          );
          log(`Linked ${brand.name} → ${ultimateParent!.name}`);
        }

        // Step 6: Create/link sister brands
        let sistersLinked = 0;
        for (const sister of sisterBrands) {
          // Check if brand already exists by wikidata_qid
          const { data: existingBrand } = await supabase
            .from("brands")
            .select("id")
            .eq("wikidata_qid", sister.qid)
            .maybeSingle();

          let sisterBrandId = existingBrand?.id;

          if (!sisterBrandId) {
            // Create a stub brand for the sister
            const { data: newBrand } = await supabase
              .from("brands")
              .insert({
                name: sister.name,
                wikidata_qid: sister.qid,
                description: sister.description,
                status: "stub",
                parent_company: ultimateParent?.name ?? null,
              })
              .select("id")
              .maybeSingle();

            sisterBrandId = newBrand?.id;
            if (sisterBrandId) log(`Created stub brand: ${sister.name}`);
          }

          // Link sister to parent company
          if (sisterBrandId && parentCompanyId) {
            await supabase.from("company_ownership").upsert(
              {
                child_brand_id: sisterBrandId,
                parent_company_id: parentCompanyId,
                parent_name: ultimateParent?.name ?? topEntity.name,
                relationship: "subsidiary",
                relationship_type: "parent",
                source: "wikidata",
                source_ref: `https://www.wikidata.org/wiki/${sister.qid}`,
                confidence: 0.8,
                is_validated: true,
                last_verified_at: new Date().toISOString(),
              },
              { onConflict: "child_brand_id,parent_company_id" }
            );
            sistersLinked++;
          }
        }

        results.push({
          brand_id: bid,
          name: brand.name,
          status: "success",
          ultimate_parent: ultimateParent?.name ?? null,
          sisters_found: sisterBrands.length,
          sisters_linked: sistersLinked,
          chain_depth: chain.length,
        });

        // Rate limit between brands
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        warn("Error processing brand", bid, (e as Error).message);
        results.push({ brand_id: bid, status: "error", error: (e as Error).message });
      }
    }

    const summary = {
      ok: true,
      processed: results.length,
      success: results.filter(r => r.status === "success").length,
      skipped: results.filter(r => r.status === "skipped").length,
      errors: results.filter(r => r.status === "error").length,
      results,
    };

    log("Complete:", JSON.stringify({ processed: summary.processed, success: summary.success }));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[seed-corporate-structure] Fatal:", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
