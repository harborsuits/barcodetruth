import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (...args: any[]) => console.log("[seed-corporate-structure]", ...args);
const warn = (...args: any[]) => console.warn("[seed-corporate-structure]", ...args);

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

async function getEntity(qid: string) {
  const res = await fetchRetry(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  if (!res.ok) throw new Error(`Entity fetch ${res.status} for ${qid}`);
  const json = await res.json();
  const entities = json?.entities ?? {};
  const key = Object.keys(entities)[0];
  return { qid: key ?? qid, entity: entities[key] };
}

const labelOf = (e: any, l = "en") => e?.labels?.[l]?.value ?? null;
const descOf = (e: any, l = "en") => e?.descriptions?.[l]?.value ?? null;

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

// Entity types that are CORPORATE (safe to follow as parents)
const CORPORATE_TYPES = new Set([
  "Q4830453",  // business
  "Q783794",   // company
  "Q431289",   // brand
  "Q891723",   // public company
  "Q167037",   // corporation
  "Q155076",   // subsidiary
  "Q1539532",  // conglomerate
  "Q507619",   // retailer
  "Q46970",    // airline
  "Q1058914",  // software company
  "Q166280",   // multinational corporation
  "Q6881511",  // enterprise
  "Q43229",    // organization
]);

// Entity types that are INVESTORS (stop walking the chain)
const INVESTOR_TYPES = new Set([
  "Q327333",   // government agency
  "Q726827",   // investment management company
  "Q180917",   // investment company
  "Q161726",   // mutual fund
  "Q3196867",  // investment fund
  "Q1433714",  // hedge fund
  "Q1144593",  // index fund
  "Q2624782",  // private equity firm
  "Q1377987",  // holding company — ambiguous but often an investor
  "Q22687",    // bank
]);

// Known asset managers by QID (hardcoded safety net)
const KNOWN_ASSET_MANAGERS = new Set([
  "Q849363",   // Vanguard Group
  "Q219635",   // BlackRock
  "Q1350802",  // State Street Corporation
  "Q2037125",  // State Street Corporation (alt QID)
  "Q7603552",  // State Street Global Advisors
  "Q1411799",  // Fidelity
  "Q1411292",  // Fidelity Investments (alt QID)
  "Q1585024",  // Capital Group
  "Q2003795",  // T. Rowe Price
  "Q727725",   // Berkshire Hathaway
  "Q192314",   // JPMorgan Chase
  "Q219508",   // Citigroup
  "Q466187",   // Goldman Sachs
  "Q217583",   // Morgan Stanley
  "Q524656",   // Charles Schwab
  "Q495123",   // Wellington Management
  "Q908461",   // Northern Trust
  "Q22687",    // bank (generic)
]);

// Also block by name pattern for entities not in the hardcoded list
const INVESTOR_NAME_PATTERNS = [
  /\bvanguard\b/i, /\bblackrock\b/i, /\bstate street\b/i, /\bfidelity\b/i,
  /\bcapital group\b/i, /\bwellington\b/i, /\bnorthern trust\b/i,
  /\bt\.\s?rowe\s?price\b/i, /\bjpmorgan\b/i, /\bgoldman sachs\b/i,
  /\bmorgan stanley\b/i, /\bcharles schwab\b/i, /\bcitigroup\b/i,
  /\binvesco\b/i, /\bpimco\b/i, /\bubs\b/i, /\bcredit suisse\b/i,
  /\bdeutsche bank\b/i, /\bbarclays\b/i, /\bhsbc\b/i,
  /\basset management\b/i, /\binvestment\s+(management|group|fund)\b/i,
];

function isCorporateEntity(entity: any, qid: string): boolean {
  if (KNOWN_ASSET_MANAGERS.has(qid)) return false;
  
  // Name-based check
  const name = entity?.labels?.en?.value ?? "";
  if (INVESTOR_NAME_PATTERNS.some(p => p.test(name))) return false;
  
  const instanceOf = claimIds(entity, "P31");
  if (instanceOf.some(t => INVESTOR_TYPES.has(t))) return false;
  if (instanceOf.some(t => CORPORATE_TYPES.has(t))) return true;
  // If no type info, assume NOT corporate (conservative)
  return false;
}

interface DiscoveredEntity {
  qid: string;
  name: string;
  description: string | null;
  ticker: string | null;
  exchange_qid: string | null;
  is_public: boolean;
  logo_url: string | null;
  parent_qids: string[];
  subsidiary_qids: string[];
  is_corporate: boolean;
}

async function discoverEntity(qid: string): Promise<DiscoveredEntity | null> {
  try {
    const { qid: resolvedQid, entity } = await getEntity(qid);
    if (!entity) return null;
    const name = labelOf(entity);
    if (!name) return null;

    const tickerArr = claimStrings(entity, "P249");
    const exchangeArr = claimIds(entity, "P414");
    // P749 = parent organization (structural) — PREFERRED
    // P127 = owned by — often includes institutional investors, use only as fallback
    const p749 = claimIds(entity, "P749");
    const p127 = claimIds(entity, "P127");
    // Prefer P749; only use P127 if P749 is empty
    const parentQids = [...new Set(p749.length > 0 ? p749 : p127)];
    const subsidiaryQids = [...new Set([...claimIds(entity, "P355"), ...claimIds(entity, "P1830")])];

    const logoClaim = entity?.claims?.P154?.[0]?.mainsnak?.datavalue?.value;
    const logo_url = logoClaim
      ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(logoClaim)}`
      : null;

    return {
      qid: resolvedQid,
      name,
      description: descOf(entity),
      ticker: tickerArr[0] ?? null,
      exchange_qid: exchangeArr[0] ?? null,
      is_public: tickerArr.length > 0 || exchangeArr.length > 0,
      logo_url,
      parent_qids: parentQids,
      subsidiary_qids: subsidiaryQids,
      is_corporate: isCorporateEntity(entity, resolvedQid),
    };
  } catch (e) {
    warn("Failed to discover entity", qid, (e as Error).message);
    return null;
  }
}

const EXCHANGE_MAP: Record<string, string> = {
  Q13677: "NYSE", Q82059: "NASDAQ", Q171240: "LSE", Q217475: "Euronext",
  Q808936: "TSX", Q549981: "ASX", Q217230: "SIX", Q485718: "HKEX",
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

    const brandIds: string[] = [];

    if (brand_id) {
      brandIds.push(brand_id);
    } else {
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

        // Step 2: Walk UP the ownership chain — ONLY follow corporate entities
        const chain: DiscoveredEntity[] = [brandEntity];
        const visited = new Set<string>([brandEntity.qid]);
        let current = brandEntity;
        let ultimateParent: DiscoveredEntity | null = null;

        while (current.parent_qids.length > 0) {
          let foundCorporateParent = false;

          for (const nextQid of current.parent_qids) {
            if (visited.has(nextQid)) continue;
            visited.add(nextQid);

            const parent = await discoverEntity(nextQid);
            if (!parent) continue;

            // KEY GUARDRAIL: Stop at investors/asset managers
            if (!parent.is_corporate) {
              log(`Stopped chain at ${parent.name} (${parent.qid}) — not corporate entity`);
              continue;
            }

            chain.push(parent);
            ultimateParent = parent;
            current = parent;
            foundCorporateParent = true;
            break; // Follow first valid corporate parent
          }

          if (!foundCorporateParent) break;
          if (chain.length > 5) break;
          await new Promise(r => setTimeout(r, 300));
        }

        // Step 3: Get subsidiaries of ultimate parent (sister brands)
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
            chain: chain.map(e => ({ qid: e.qid, name: e.name, is_corporate: e.is_corporate })),
            ultimate_parent: ultimateParent ? { qid: ultimateParent.qid, name: ultimateParent.name } : null,
            sister_brands: sisterBrands.map(e => ({ qid: e.qid, name: e.name })),
          });
          continue;
        }

        // Step 4: Upsert ultimate parent via company spine RPC
        let parentCompanyId: string | null = null;

        if (ultimateParent) {
          const { data: spineId } = await supabase.rpc("upsert_company_spine", {
            p_name: ultimateParent.name,
            p_wikidata_qid: ultimateParent.qid,
            p_ticker: ultimateParent.ticker,
            p_exchange: ultimateParent.exchange_qid ? EXCHANGE_MAP[ultimateParent.exchange_qid] ?? null : null,
            p_is_public: ultimateParent.is_public,
            p_logo_url: ultimateParent.logo_url,
            p_description: ultimateParent.description,
            p_source: "wikidata",
          });

          parentCompanyId = spineId as string | null;
          log(`Upserted parent company via spine: ${ultimateParent.name} (${parentCompanyId})`);

          // Populate normalized_name on the company record
          if (parentCompanyId) {
            const normalizedName = ultimateParent.name
              .toLowerCase()
              .replace(/[éèêë]/g, 'e').replace(/[àáâãä]/g, 'a')
              .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
              .replace(/[ùúûü]/g, 'u').replace(/[ñ]/g, 'n').replace(/[ç]/g, 'c')
              .replace(/\b(inc|incorporated|corp|corporation|co|company|llc|llp|ltd|limited|plc|ag|sa|gmbh|nv|bv|se|spa|srl|pty|pvt|holdings|group|enterprises|industries|international|global|north america|usa|us|americas|of america|the)\b\.?/gi, '')
              .replace(/[^a-z0-9\s]/g, '')
              .replace(/\s+/g, ' ')
              .trim();

            await supabase.from("companies").update({
              normalized_name: normalizedName,
            }).eq("id", parentCompanyId);
          }
        }

        // Step 4b: Upsert intermediate companies in the chain with parent_company_id
        // chain = [brand, intermediate1, ..., ultimateParent]
        // Walk backwards to set parent_company_id on each
        const chainCompanyIds: string[] = [];
        for (let i = chain.length - 1; i >= 0; i--) {
          const entity = chain[i];
          if (entity.qid === brandEntity.qid) continue; // skip the brand itself
          
          const { data: compId } = await supabase.rpc("upsert_company_spine", {
            p_name: entity.name,
            p_wikidata_qid: entity.qid,
            p_ticker: entity.ticker,
            p_exchange: entity.exchange_qid ? EXCHANGE_MAP[entity.exchange_qid] ?? null : null,
            p_is_public: entity.is_public,
            p_logo_url: entity.logo_url,
            p_description: entity.description,
            p_source: "wikidata",
          });
          
          if (compId) {
            // Set parent_company_id to the previously processed entity (one level up)
            const parentId = chainCompanyIds.length > 0 ? chainCompanyIds[chainCompanyIds.length - 1] : null;
            
            const normalizedName = entity.name
              .toLowerCase()
              .replace(/[éèêë]/g, 'e').replace(/[àáâãä]/g, 'a')
              .replace(/[ìíîï]/g, 'i').replace(/[òóôõö]/g, 'o')
              .replace(/[ùúûü]/g, 'u').replace(/[ñ]/g, 'n').replace(/[ç]/g, 'c')
              .replace(/\b(inc|incorporated|corp|corporation|co|company|llc|llp|ltd|limited|plc|ag|sa|gmbh|nv|bv|se|spa|srl|pty|pvt|holdings|group|enterprises|industries|international|global|north america|usa|us|americas|of america|the)\b\.?/gi, '')
              .replace(/[^a-z0-9\s]/g, '')
              .replace(/\s+/g, ' ')
              .trim();

            await supabase.from("companies").update({
              normalized_name: normalizedName,
              parent_company_id: parentId,
            }).eq("id", compId);

            chainCompanyIds.push(compId as string);
          }
        }
        
        // parentCompanyId is the ultimate parent (last in chainCompanyIds, or from Step 4)
        if (!parentCompanyId && chainCompanyIds.length > 0) {
          parentCompanyId = chainCompanyIds[0]; // first pushed = ultimate parent
        }

        // Step 5: Link brand to parent
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

          // Also update brand.parent_company field for quick display
          await supabase
            .from("brands")
            .update({ parent_company: ultimateParent!.name })
            .eq("id", bid);
        }

        // Step 6: Create/link sister brands
        let sistersLinked = 0;
        for (const sister of sisterBrands) {
          const { data: existingBrand } = await supabase
            .from("brands")
            .select("id")
            .eq("wikidata_qid", sister.qid)
            .maybeSingle();

          let sisterBrandId = existingBrand?.id;

          if (!sisterBrandId) {
            const { data: newBrand } = await supabase
              .from("brands")
              .insert({
                name: sister.name,
                wikidata_qid: sister.qid,
                description: sister.description,
                status: "stub",
                parent_company: ultimateParent?.name ?? topEntity.name,
              })
              .select("id")
              .maybeSingle();

            sisterBrandId = newBrand?.id;
            if (sisterBrandId) log(`Created stub brand: ${sister.name}`);
          }

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
