import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const log = (...args: any[]) => console.log("[resolve-company-sec]", ...args);

const SEC_BASE = "https://efts.sec.gov/LATEST/search-index?q=";
const SEC_SUBMISSIONS = "https://data.sec.gov/submissions";
const SEC_UA =
  "BarcodetruthBot/1.0 (contact: support@barcodetruth.app; SEC EDGAR resolver)";

// ── SEC EDGAR full-text company search ──────────────────────────
async function searchCompany(
  query: string
): Promise<{ cik: string; name: string; ticker?: string }[]> {
  // Use the EDGAR full-text search API
  const url = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(
    query
  )}%22&dateRange=custom&startdt=2020-01-01&forms=10-K&hits.hits.total.value=5`;

  // Fallback: use the company search endpoint
  const companyUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(
    query
  )}%22&forms=10-K`;

  // Primary approach: use company tickers JSON
  const tickerUrl = `https://www.sec.gov/cgi-bin/browse-edgar?company=${encodeURIComponent(
    query
  )}&CIK=&type=10-K&dateb=&owner=include&count=10&search_text=&action=getcompany&output=atom`;

  // Use the EDGAR company search API (most reliable)
  const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(
    query
  )}%22&forms=10-K`;

  // Best approach: company_search endpoint
  const bestUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(query)}%22`;

  // Actually use the correct endpoint
  const edgarSearchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(query)}%22&dateRange=custom&startdt=2023-01-01&forms=10-K`;

  // Use the simple company tickers file (most reliable for CIK lookup)
  try {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": SEC_UA, Accept: "application/json" },
    });
    if (!res.ok) {
      log("company_tickers.json failed:", res.status);
      return [];
    }
    const data = await res.json();
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    const results: { cik: string; name: string; ticker?: string }[] = [];

    for (const key of Object.keys(data)) {
      const entry = data[key];
      const companyName = (entry.title || "").toLowerCase().replace(/[^a-z0-9 ]/g, "");
      if (
        companyName.includes(normalizedQuery) ||
        normalizedQuery.includes(companyName)
      ) {
        results.push({
          cik: String(entry.cik_str).padStart(10, "0"),
          name: entry.title,
          ticker: entry.ticker,
        });
      }
      if (results.length >= 5) break;
    }
    return results;
  } catch (err) {
    log("company_tickers search error:", err);
    return [];
  }
}

// ── Fetch company submissions (filings metadata) ───────────────
interface SecSubmissions {
  cik: string;
  entityType: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  ein: string;
  sic: string;
  sicDescription: string;
  stateOfIncorporation: string;
  filings: {
    recent: {
      form: string[];
      filingDate: string[];
      primaryDocument: string[];
      accessionNumber: string[];
    };
  };
}

async function fetchSubmissions(cik: string): Promise<SecSubmissions | null> {
  const url = `${SEC_SUBMISSIONS}/CIK${cik}.json`;
  log("Fetching submissions:", url);
  const res = await fetch(url, {
    headers: { "User-Agent": SEC_UA, Accept: "application/json" },
  });
  if (!res.ok) {
    log("Submissions fetch failed:", res.status);
    return null;
  }
  return await res.json();
}

// ── Extract executives from DEF 14A ────────────────────────────
interface Executive {
  name: string;
  title: string;
}

function extractExecutivesFromText(text: string): Executive[] {
  const executives: Executive[] = [];
  const titlePatterns = [
    /(?:chief\s+executive\s+officer|ceo)/i,
    /(?:chief\s+financial\s+officer|cfo)/i,
    /(?:chief\s+operating\s+officer|coo)/i,
    /(?:chief\s+technology\s+officer|cto)/i,
    /(?:president)/i,
    /(?:chairman|chair\s+of\s+the\s+board)/i,
    /(?:executive\s+vice\s+president|evp)/i,
    /(?:senior\s+vice\s+president|svp)/i,
    /(?:general\s+counsel)/i,
    /(?:secretary)/i,
  ];

  // Pattern: "Name, Title" or "Name — Title"
  const nameLinePattern =
    /([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+(?:\s+(?:Jr\.|Sr\.|III|IV|II))?)\s*[,—–-]\s*((?:Chief|President|Chairman|Chair|Executive|Senior|General|Vice)[^\n]{5,60})/g;

  let match;
  while ((match = nameLinePattern.exec(text)) !== null) {
    const name = match[1].trim();
    const title = match[2].trim();
    if (
      name.length > 3 &&
      name.length < 60 &&
      !executives.some((e) => e.name === name)
    ) {
      executives.push({ name, title });
    }
    if (executives.length >= 15) break;
  }

  return executives;
}

// ── Extract subsidiaries from 10-K Exhibit 21 ──────────────────
function extractSubsidiariesFromText(text: string): string[] {
  const subsidiaries: string[] = [];
  // Look for lines that appear to be entity names (capitalized, may include LLC, Inc, etc.)
  const entityPattern =
    /^[\s]*([A-Z][A-Za-z\s&,.'()-]+(?:Inc\.?|LLC|Ltd\.?|Corp\.?|Company|Co\.?|L\.P\.?|LP|N\.V\.?|S\.A\.?|GmbH|PLC|Limited))[\s]*$/gm;

  let match;
  while ((match = entityPattern.exec(text)) !== null) {
    const name = match[1].trim();
    if (
      name.length > 3 &&
      name.length < 100 &&
      !subsidiaries.includes(name)
    ) {
      subsidiaries.push(name);
    }
    if (subsidiaries.length >= 100) break;
  }

  return subsidiaries;
}

// ── Main handler ────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { company_name, ticker, cik, company_id } = await req.json();

    if (!company_name && !ticker && !cik) {
      return new Response(
        JSON.stringify({ error: "company_name, ticker, or cik required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Step 1: Resolve CIK
    let resolvedCik: string | null = cik || null;
    let resolvedName = company_name || "";
    let resolvedTicker = ticker || "";

    if (!resolvedCik) {
      const searchTerm = ticker || company_name;
      log("Searching SEC for:", searchTerm);
      const results = await searchCompany(searchTerm);

      if (results.length === 0) {
        log("No SEC results for:", searchTerm);
        return new Response(
          JSON.stringify({ matched: false, query: searchTerm }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Score matches
      const normalizedQuery = searchTerm.toLowerCase().trim();
      let bestMatch = results[0];
      let bestScore = 0;

      for (const r of results) {
        let score = 0;
        const rName = r.name.toLowerCase();
        if (rName === normalizedQuery) score += 100;
        else if (rName.includes(normalizedQuery) || normalizedQuery.includes(rName)) score += 60;
        else {
          const qWords = new Set(normalizedQuery.split(/\s+/));
          score += rName.split(/\s+/).filter((w: string) => qWords.has(w)).length * 15;
        }
        if (ticker && r.ticker?.toUpperCase() === ticker.toUpperCase()) score += 80;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = r;
        }
      }

      if (bestScore < 20) {
        return new Response(
          JSON.stringify({ matched: false, best_score: bestScore, query: searchTerm }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      resolvedCik = bestMatch.cik;
      resolvedName = bestMatch.name;
      resolvedTicker = bestMatch.ticker || resolvedTicker;
      log("Matched:", resolvedName, "CIK:", resolvedCik, "score:", bestScore);
    }

    // Step 2: Fetch submissions
    const submissions = await fetchSubmissions(resolvedCik);
    if (!submissions) {
      return new Response(
        JSON.stringify({ matched: true, cik: resolvedCik, name: resolvedName, error: "Could not fetch submissions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Upsert into company spine
    const spineData: Record<string, any> = {
      p_name: submissions.name || resolvedName,
      p_sec_cik: resolvedCik,
    };
    if (resolvedTicker) spineData.p_ticker = resolvedTicker;
    if (submissions.exchanges?.[0]) spineData.p_exchange = submissions.exchanges[0];
    if (submissions.stateOfIncorporation) {
      spineData.p_jurisdiction = `US-${submissions.stateOfIncorporation}`;
    }
    spineData.p_legal_name = submissions.name;

    const { data: spineId, error: spineError } = await supabase.rpc(
      "upsert_company_spine",
      spineData
    );

    if (spineError) {
      log("Spine upsert error:", spineError);
    } else {
      log("Spine upsert result:", spineId);
      // Update last_sec_refresh
      if (spineId) {
        await supabase
          .from("companies")
          .update({ last_sec_refresh: new Date().toISOString() })
          .eq("id", spineId);
      }
    }

    const targetCompanyId = company_id || spineId;

    // Step 4: Extract executives from recent DEF 14A
    const executives: Executive[] = [];
    if (submissions.filings?.recent) {
      const { form, accessionNumber } = submissions.filings.recent;
      for (let i = 0; i < form.length && i < 50; i++) {
        if (form[i] === "DEF 14A" || form[i] === "DEFM14A") {
          // We found a proxy statement — try to fetch its index
          const accNum = accessionNumber[i].replace(/-/g, "");
          const indexUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(resolvedCik, 10)}/${accNum}/`;
          log("Found proxy statement:", indexUrl);
          // For now, note the filing exists — full text extraction requires HTML parsing
          // which is expensive. Store the filing reference.
          executives.push({
            name: "(proxy statement found)",
            title: `DEF 14A filing at ${indexUrl}`,
          });
          break;
        }
      }
    }

    // Step 5: Look for 10-K Exhibit 21 (subsidiaries)
    const subsidiaryNames: string[] = [];
    if (submissions.filings?.recent) {
      const { form } = submissions.filings.recent;
      const tenKCount = form.filter((f: string) => f === "10-K").length;
      log(`Found ${tenKCount} 10-K filings`);
      // Subsidiary extraction from Exhibit 21 requires parsing filing documents
      // For now, we record the 10-K filing metadata
    }

    // Step 6: Store executives if found
    if (targetCompanyId && executives.length > 0 && executives[0].name !== "(proxy statement found)") {
      for (const exec of executives) {
        const { error } = await supabase
          .from("company_key_people")
          .upsert(
            {
              company_id: targetCompanyId,
              name: exec.name,
              title: exec.title,
              source: "sec_edgar",
              source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${resolvedCik}&type=DEF+14A`,
              is_current: true,
            },
            { onConflict: "company_id,name,title" }
          );
        if (error) log("Key people upsert error:", error);
      }
    }

    // Build response
    const tickers = submissions.tickers || [];
    const exchanges = submissions.exchanges || [];

    return new Response(
      JSON.stringify({
        matched: true,
        cik: resolvedCik,
        name: submissions.name,
        entity_type: submissions.entityType,
        sic: submissions.sic,
        sic_description: submissions.sicDescription,
        state_of_incorporation: submissions.stateOfIncorporation,
        tickers,
        exchanges,
        spine_id: spineId,
        recent_filings: submissions.filings?.recent?.form?.slice(0, 10) || [],
        executives_found: executives.length,
        subsidiaries_found: subsidiaryNames.length,
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
