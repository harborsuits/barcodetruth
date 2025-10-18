// Unified real ingestion: GDELT + Guardian + NewsAPI + NYT + GNews -> brand_events + event_sources (dedup by URL hash)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Brand = { id: string; name: string; aliases: string[]; ticker: string | null; newsroom_domains: string[] };
type GdeltItem = { url: string; title: string; seendate: string; domain?: string };
type NewsArticle = { title: string; summary: string; url: string; published_at: string; source_name: string; category: "labor" | "environment" | "politics" | "social" };

const QUERY_TERMS = [
  "OSHA", "violation", "safety", "workplace", "worker", "union", "wage", "discrimination",
  "harassment", "injury", "fatality", "labor", "employee", "fired", "layoff",
  "EPA", "pollution", "emissions", "environmental", "toxic", "waste", "spill",
  "contamination", "climate", "sustainability", "fine", "penalty",
  "lawsuit", "recall", "boycott", "scandal", "fraud", "deceptive", "settlement",
  "consumer", "data breach", "privacy", "investigation",
  "FEC", "donation", "lobbying", "PAC", "campaign", "political",
  "allegation", "charged", "accused", "complaint", "regulatory"
].join(" OR ");

function canonicalize(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    [...u.searchParams.keys()]
      .filter(k => /^utm_|^fbclid$/i.test(k))
      .forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return url;
  }
}

async function sha1(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert SHA-1 hash to UUID format for Postgres compatibility
function hashToUuid(hash: string): string {
  // Take first 32 hex chars and format as UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

// Enhanced categorization with priority: labor > environment > politics > social
function categorize(title: string, text: string, urlPath: string): "labor" | "environment" | "politics" | "social" {
  const combined = `${title} ${text} ${urlPath}`.toLowerCase();
  
  // Labor: highest priority - worker safety, wages, unions, OSHA violations
  const laborKw = [
    /\b(strike|walkout|union|organizing|collective bargaining)\b/i,
    /\b(wage|overtime|layoff|discrimination|harassment)\b/i,
    /\b(osha|workplace safety|worker injury|labor violation)\b/i,
    /\b(fired|terminated|wrongful termination|retaliation)\b/i
  ];
  if (laborKw.some(re => re.test(combined))) return "labor";
  
  // Environment: second priority - EPA, pollution, emissions, recalls
  const envKw = [
    /\b(epa|emission|pollution|toxic|spill|contamination)\b/i,
    /\b(environmental violation|carbon|methane|deforestation)\b/i,
    /\b(recall.*(food|product)|sustainab|green energy)\b/i
  ];
  if (envKw.some(re => re.test(combined))) return "environment";
  
  // Politics: third priority - lobbying, donations, regulatory
  const polKw = [
    /\b(congress|senate|regulator|ftc|doj|bill|law)\b/i,
    /\b(donation|lobby|pac|campaign|political contribution)\b/i,
    /\b(tariff|sanction|attorney general|governor)\b/i
  ];
  if (polKw.some(re => re.test(combined))) return "politics";
  
  // Social: default - general news, marketing, product launches
  return "social";
}

// Relevance scoring to filter out unrelated articles
function wordBoundary(name: string): RegExp {
  // Escape special regex characters in brand name
  const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i');
}

function scoreRelevance(
  brand: Brand,
  title: string,
  text: string,
  domain: string
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  
  // Build regex for brand name and aliases
  const nameRE = wordBoundary(brand.name);
  const aliasREs = (brand.aliases || []).map(a => wordBoundary(a));
  const allREs = [nameRE, ...aliasREs];
  
  // Exact match in title (highest weight)
  if (title && allREs.some(re => re.test(title))) {
    score += 5;
    reasons.push('title_match');
  }
  
  // Match in first 300 chars (article lead)
  const lead = text.slice(0, 300);
  if (lead && allREs.some(re => re.test(lead))) {
    score += 3;
    reasons.push('lead_match');
  }
  
  // Ticker mention alongside brand name
  if (brand.ticker && text) {
    const tickerRE = new RegExp(`\\b${brand.ticker}\\b`, 'i');
    if (tickerRE.test(text) && allREs.some(re => re.test(text))) {
      score += 2;
      reasons.push('ticker_mention');
    }
  }
  
  // Brand's own newsroom domain (press release)
  if (brand.newsroom_domains && brand.newsroom_domains.length > 0) {
    if (brand.newsroom_domains.some(d => domain.includes(d))) {
      score += 2;
      reasons.push('newsroom_domain');
    }
  }
  
  // Major news outlets get slight boost if brand mentioned
  const majorOutlets = ['reuters', 'bloomberg', 'wsj', 'nytimes', 'guardian', 'ft.com', 'apnews'];
  if (majorOutlets.some(o => domain.includes(o)) && allREs.some(re => re.test(title + text))) {
    score += 1;
    reasons.push('major_outlet');
  }
  
  // Negative disambiguation patterns
  const negativePatterns = [
    { re: /\battorney general\s+[a-z]+\s+mills?\b/i, reason: 'attorney_general_mills' },
    { re: /\bgeneral mill\b(?!\s*(inc|foods|company))/i, reason: 'singular_mill' },
    { re: /\bmills?\s+college\b/i, reason: 'mills_college' },
    { re: /\bmills?\s+university\b/i, reason: 'mills_university' }
  ];
  
  for (const { re, reason } of negativePatterns) {
    if (re.test(title + ' ' + text)) {
      score -= 3;
      reasons.push(`neg_${reason}`);
    }
  }
  
  return { score, reason: reasons.join(',') };
}

// Convert GDELT date format and categorize
function parseGdeltArticle(i: GdeltItem, brandName: string): NewsArticle {
  let publishedAt = new Date().toISOString();
  if (i.seendate && /^\d{14}$/.test(i.seendate)) {
    const y = i.seendate.slice(0, 4);
    const m = i.seendate.slice(4, 6);
    const d = i.seendate.slice(6, 8);
    const h = i.seendate.slice(8, 10);
    const min = i.seendate.slice(10, 12);
    const s = i.seendate.slice(12, 14);
    publishedAt = `${y}-${m}-${d}T${h}:${min}:${s}Z`;
  }
  
  const urlObj = new URL(i.url);
  const title = i.title ?? `News: ${brandName}`;
  const category = categorize(title, "", urlObj.pathname);
  
  return {
    title,
    summary: "",
    url: i.url,
    published_at: publishedAt,
    source_name: i.domain ?? urlObj.hostname,
    category
  };
}

async function fetchGDELT(brandName: string, max: number, daysBack = 7): Promise<NewsArticle[]> {
  const q = encodeURIComponent(`"${brandName}"`);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&maxrecords=${max}&format=json&timelang=eng&timespan=${daysBack}d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GDELT: ${res.status}`);
  const gd = await res.json();
  const items: GdeltItem[] = gd?.articles ?? [];
  return items.map(i => parseGdeltArticle(i, brandName));
}

async function fetchGuardian(apiKey: string, brandName: string, daysBack = 7): Promise<NewsArticle[]> {
  const searchQuery = `${brandName} AND (${QUERY_TERMS})`;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const url = new URL("https://content.guardianapis.com/search");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("show-fields", "headline,trailText,bodyText");
  url.searchParams.set("page-size", "10");
  url.searchParams.set("order-by", "newest");
  url.searchParams.set("from-date", fromDate.toISOString().split('T')[0]);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Guardian: ${res.status}`);
  const data = await res.json();
  const results = data.response?.results || [];
  return results.map((a: any) => {
    const urlObj = new URL(a.webUrl);
    const title = a.fields?.headline || a.webTitle;
    const text = a.fields?.trailText || a.fields?.bodyText?.slice(0, 300) || "";
    return {
      title,
      summary: text,
      url: a.webUrl,
      published_at: a.webPublicationDate,
      source_name: "The Guardian",
      category: categorize(title, text, urlObj.pathname)
    };
  });
}

async function fetchNewsAPI(apiKey: string, brandName: string, daysBack = 7): Promise<NewsArticle[]> {
  const searchQuery = `${brandName} AND (${QUERY_TERMS})`;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("from", fromDate.toISOString());
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`NewsAPI: ${res.status}`);
  const data = await res.json();
  const articles = data.articles || [];
  return articles.map((a: any) => {
    const urlObj = new URL(a.url);
    const title = a.title;
    const text = a.description || a.content?.slice(0, 300) || "";
    return {
      title,
      summary: text,
      url: a.url,
      published_at: a.publishedAt,
      source_name: a.source?.name || "NewsAPI",
      category: categorize(title, text, urlObj.pathname)
    };
  });
}

async function fetchNYTimes(apiKey: string, brandName: string, daysBack = 7): Promise<NewsArticle[]> {
  const searchQuery = `${brandName} AND (${QUERY_TERMS})`;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const url = new URL("https://api.nytimes.com/svc/search/v2/articlesearch.json");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("sort", "newest");
  url.searchParams.set("fl", "headline,abstract,web_url,pub_date");
  url.searchParams.set("begin_date", fromDate.toISOString().split('T')[0].replace(/-/g, ''));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`NYT: ${res.status}`);
  const data = await res.json();
  const docs = data.response?.docs || [];
  return docs.map((a: any) => {
    const urlObj = new URL(a.web_url);
    const title = a.headline?.main || "";
    const text = a.abstract || "";
    return {
      title,
      summary: text,
      url: a.web_url,
      published_at: a.pub_date,
      source_name: "The New York Times",
      category: categorize(title, text, urlObj.pathname)
    };
  });
}

async function fetchGNews(apiKey: string, brandName: string, daysBack = 7): Promise<NewsArticle[]> {
  const searchQuery = `${brandName} AND (${QUERY_TERMS})`;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const url = new URL("https://gnews.io/api/v4/search");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("token", apiKey);
  url.searchParams.set("lang", "en");
  url.searchParams.set("max", "10");
  url.searchParams.set("sortby", "publishedAt");
  url.searchParams.set("from", fromDate.toISOString());
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GNews: ${res.status}`);
  const data = await res.json();
  const articles = data.articles || [];
  return articles.map((a: any) => {
    const urlObj = new URL(a.url);
    const title = a.title;
    const text = a.description || a.content?.slice(0, 300) || "";
    return {
      title,
      summary: text,
      url: a.url,
      published_at: a.publishedAt,
      source_name: a.source?.name || "GNews",
      category: categorize(title, text, urlObj.pathname)
    };
  });
}

async function fetchMediastack(apiKey: string, brandName: string, daysBack = 7): Promise<NewsArticle[]> {
  const searchQuery = `${brandName} ${QUERY_TERMS}`;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const url = new URL("http://api.mediastack.com/v1/news");
  url.searchParams.set("access_key", apiKey);
  url.searchParams.set("keywords", searchQuery);
  url.searchParams.set("languages", "en");
  url.searchParams.set("sort", "published_desc");
  url.searchParams.set("limit", "10");
  url.searchParams.set("date", fromDate.toISOString().split('T')[0]);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Mediastack: ${res.status}`);
  const data = await res.json();
  const articles = data.data || [];
  return articles.map((a: any) => {
    const urlObj = new URL(a.url);
    const title = a.title;
    const text = a.description || "";
    return {
      title,
      summary: text,
      url: a.url,
      published_at: a.published_at,
      source_name: a.source || "Mediastack",
      category: categorize(title, text, urlObj.pathname)
    };
  });
}

async function fetchCurrents(apiKey: string, brandName: string, daysBack = 7): Promise<NewsArticle[]> {
  const searchQuery = `${brandName} ${QUERY_TERMS}`;
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - daysBack);
  const url = new URL("https://api.currentsapi.services/v1/search");
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("keywords", searchQuery);
  url.searchParams.set("language", "en");
  url.searchParams.set("start_date", fromDate.toISOString());
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Currents: ${res.status}`);
  const data = await res.json();
  const articles = data.news || [];
  return articles.map((a: any) => {
    const urlObj = new URL(a.url);
    const title = a.title;
    const text = a.description || "";
    return {
      title,
      summary: text,
      url: a.url,
      published_at: a.published,
      source_name: a.author || "Currents",
      category: categorize(title, text, urlObj.pathname)
    };
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[Orchestrator] Function invoked");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand_id");
  const max = parseInt(url.searchParams.get("max") || "20");
  const daysBack = parseInt(url.searchParams.get("days_back") || "7");

  console.log(`[Orchestrator] Params - brandId: ${brandId}, max: ${max}, daysBack: ${daysBack}`);

  try {
    let brands: Brand[] = [];
    if (brandId) {
      console.log(`[Orchestrator] Fetching specific brand: ${brandId}`);
      const { data, error: brandError } = await supabase
        .from("brands")
        .select("id,name,aliases,ticker,newsroom_domains")
        .eq("id", brandId)
        .limit(1);
      if (brandError) {
        console.error("[Orchestrator] Brand fetch error:", brandError);
        throw brandError;
      }
      brands = (data ?? []).map(b => ({
        id: b.id,
        name: b.name,
        aliases: b.aliases || [],
        ticker: b.ticker || null,
        newsroom_domains: b.newsroom_domains || []
      }));
      console.log(`[Orchestrator] Found brand: ${brands[0]?.name || 'none'}`);
    } else {
      console.log("[Orchestrator] Fetching active brands (no specific brand_id)");
      const { data, error: brandsError } = await supabase
        .from("brands")
        .select("id,name,aliases,ticker,newsroom_domains")
        .eq("is_active", true)
        .limit(10);
      if (brandsError) {
        console.error("[Orchestrator] Brands fetch error:", brandsError);
        throw brandsError;
      }
      brands = (data ?? []).map(b => ({
        id: b.id,
        name: b.name,
        aliases: b.aliases || [],
        ticker: b.ticker || null,
        newsroom_domains: b.newsroom_domains || []
      }));
      console.log(`[Orchestrator] Found ${brands.length} active brands`);
    }

    if (brands.length === 0) {
      console.warn("[Orchestrator] No brands to process");
      return new Response(
        JSON.stringify({ ok: true, brands: 0, totalInserted: 0, totalSkipped: 0, message: "No brands found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const guardianKey = Deno.env.get("GUARDIAN_API_KEY");
    const newsApiKey = Deno.env.get("NEWSAPI_KEY");
    const nytKey = Deno.env.get("NYT_API_KEY");
    const gnewsKey = Deno.env.get("GNEWS_API_KEY");
    const mediastackKey = Deno.env.get("MEDIASTACK_API_KEY");
    const currentsKey = Deno.env.get("CURRENTS_API_KEY");

    console.log(`[Orchestrator] API Keys available - Guardian: ${!!guardianKey}, NewsAPI: ${!!newsApiKey}, NYT: ${!!nytKey}, GNews: ${!!gnewsKey}, Mediastack: ${!!mediastackKey}, Currents: ${!!currentsKey}`);

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const b of brands) {
      console.log(`[Orchestrator] Processing brand: ${b.name}`);
      const allArticles: NewsArticle[] = [];

      // Fetch from all sources
      try {
        const gdeltArticles = await fetchGDELT(b.name, max, daysBack);
        allArticles.push(...gdeltArticles);
        console.log(`[GDELT] Fetched ${gdeltArticles.length} articles for ${b.name}`);
      } catch (e) {
        console.error(`[GDELT] Error for ${b.name}:`, e);
      }

      if (guardianKey) {
        try {
          const guardianArticles = await fetchGuardian(guardianKey, b.name, daysBack);
          allArticles.push(...guardianArticles);
          console.log(`[Guardian] Fetched ${guardianArticles.length} articles for ${b.name}`);
        } catch (e) {
          console.error(`[Guardian] Error for ${b.name}:`, e);
        }
      }

      if (newsApiKey) {
        try {
          const newsApiArticles = await fetchNewsAPI(newsApiKey, b.name, daysBack);
          allArticles.push(...newsApiArticles);
          console.log(`[NewsAPI] Fetched ${newsApiArticles.length} articles for ${b.name}`);
        } catch (e) {
          console.error(`[NewsAPI] Error for ${b.name}:`, e);
        }
      }

      if (nytKey) {
        try {
          const nytArticles = await fetchNYTimes(nytKey, b.name, daysBack);
          allArticles.push(...nytArticles);
          console.log(`[NYT] Fetched ${nytArticles.length} articles for ${b.name}`);
        } catch (e) {
          console.error(`[NYT] Error for ${b.name}:`, e);
        }
      }

      if (gnewsKey) {
        try {
          const gnewsArticles = await fetchGNews(gnewsKey, b.name, daysBack);
          allArticles.push(...gnewsArticles);
          console.log(`[GNews] Fetched ${gnewsArticles.length} articles for ${b.name}`);
        } catch (e) {
          console.error(`[GNews] Error for ${b.name}:`, e);
        }
      }

      if (mediastackKey) {
        try {
          const mediastackArticles = await fetchMediastack(mediastackKey, b.name, daysBack);
          allArticles.push(...mediastackArticles);
          console.log(`[Mediastack] Fetched ${mediastackArticles.length} articles for ${b.name}`);
        } catch (e) {
          console.error(`[Mediastack] Error for ${b.name}:`, e);
        }
      }

      if (currentsKey) {
        try {
          const currentsArticles = await fetchCurrents(currentsKey, b.name, daysBack);
          allArticles.push(...currentsArticles);
          console.log(`[Currents] Fetched ${currentsArticles.length} articles for ${b.name}`);
        } catch (e) {
          console.error(`[Currents] Error for ${b.name}:`, e);
        }
      }

      console.log(`[Orchestrator] Total ${allArticles.length} articles fetched for ${b.name}`);

      if (allArticles.length === 0) {
        console.warn(`[Orchestrator] No articles found for ${b.name} - skipping insert loop`);
        continue;
      }

      for (const article of allArticles) {
        const urlCanon = canonicalize(article.url);
        const urlHash = await sha1(urlCanon);
        
        // Score relevance and filter out noise
        const urlObj = new URL(urlCanon);
        const domain = urlObj.hostname;
        const relevance = scoreRelevance(b, article.title, article.summary, domain);
        
        // Drop articles with low relevance score
        if (relevance.score < 5) {
          console.log(`[Relevance] Dropping low-score article (${relevance.score}): ${article.title.slice(0, 60)}...`);
          totalSkipped++;
          continue;
        }
        
        // Deterministic event_id from brand + url so re-runs are idempotent
        const eventIdHash = await sha1(`${b.id}:${urlHash}`);
        const eventId = hashToUuid(eventIdHash);

        console.log(`[Orchestrator] Processing article for ${b.name}: ${article.title.slice(0, 50)}... eventId=${eventId.slice(0, 8)}, relevance=${relevance.score}`);

        // 1) Upsert brand_events first (so FK exists)
        const { error: evErr } = await supabase
          .from("brand_events")
          .upsert({
            event_id: eventId,
            brand_id: b.id,
            event_date: article.published_at,
            category: article.category,
            verification: "corroborated",
            title: article.title.slice(0, 512),
            description: article.summary.slice(0, 1000),
            relevance_score: relevance.score,
            disambiguation_reason: relevance.reason || null,
            is_test: false
          }, { onConflict: 'event_id' });

        if (evErr) {
          console.error(`[Event] Upsert error for ${b.name}:`, evErr);
          continue;
        }

        // 2) Upsert event_sources and link it via event_id
        const { error: srcErr, data: srcData } = await supabase
          .from("event_sources")
          .upsert({
            canonical_url: urlCanon,
            canonical_url_hash: urlHash,
            source_name: article.source_name,
            registrable_domain: domain,
            title: article.title,
            source_date: article.published_at,
            is_primary: true,
            event_id: eventId  // THE CRITICAL LINK
          }, { onConflict: 'canonical_url_hash' });

        if (srcErr) {
          console.error(`[Source] Upsert error for ${b.name}:`, srcErr);
        } else {
          totalInserted++;
          console.log(`[Orchestrator] Linked source to event: ${article.title.slice(0, 60)}... (eventId=${eventId.slice(0, 8)})`);
        }
      }
    }

    console.log(`[Orchestrator] Complete - ${totalInserted} inserted, ${totalSkipped} skipped`);

    return new Response(
      JSON.stringify({
        ok: true,
        brands: brands.length,
        totalInserted,
        totalSkipped
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (e: any) {
    console.error("[Orchestrator] Fatal error:", e);
    return new Response(
      JSON.stringify({
        ok: false,
        error: String(e?.message || e)
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});