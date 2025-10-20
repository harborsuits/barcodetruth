// Unified real ingestion: GDELT + Guardian + NewsAPI + NYT + GNews -> brand_events + event_sources (dedup by URL hash)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { RELEVANCE_MIN_ACCEPTED, RELEVANCE_MAX_SCORE } from "../_shared/scoringConstants.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Brand = { id: string; name: string; aliases: string[]; ticker: string | null; newsroom_domains: string[]; monitoring_config?: any };
type GdeltItem = { url: string; title: string; seendate: string; domain?: string };
type NewsArticle = { title: string; summary: string; url: string; published_at: string; source_name: string; category?: "labor" | "environment" | "politics" | "social" };

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

// Language filter: detect non-English by character ratio
function nonAsciiRatio(s: string): number {
  return (s.match(/[^\x00-\x7F]/g)?.length ?? 0) / Math.max(1, s.length);
}

// ---- relevance & filtering -------------------------------------------------
const ESC = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

// Business context cues - comprehensive coverage including financial, organizational, and regulatory terms
const BUSINESS = /\b(company|companies|brand|brands|factory|factories|plant|facility|product|products|recall|device|drug|food|cereal|earnings?|revenue|profit|ceo|chief|executive|officer|acquisition|merger|lawsuit|settlement|regulator|os(h|ha)|epa|fda|fec|sec|corporate|corporation|business|manufacturer|manufacturing|sales|market|markets|industry|consumer|customers?|fine|penalty|penalties|violation|violations|complaint|investigation|probe|charges?|sued|suing|settled|alliance|coalition|association|organization|partnership|initiative|campaign|program|policy|policies|statement|announce|announced|report|reports|filing|disclosure|stock|stocks|shares|equity|investment|investor|shareholders?|portfolio|capital|financial|fund|funds)\b/i;

function windowHit(text: string, brandRE: RegExp, windowTokens = 8) {
  const tokens = text.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    if (brandRE.test(tokens[i])) {
      const start = Math.max(0, i - windowTokens);
      const end = Math.min(tokens.length - 1, i + windowTokens);
      for (let j = start; j <= end; j++) {
        if (BUSINESS.test(tokens[j])) return true;
      }
    }
  }
  return false;
}

// Universal site section configuration (applies to all brands)
const SITE_SECTIONS: Record<string, string[]> = {
  'theguardian.com': ['business', 'environment', 'money', 'food', 'science'],
  'nytimes.com': ['business', 'climate', 'technology'],
  'washingtonpost.com': ['business', 'climate-environment', 'technology', 'national'],
  'bbc.com': ['business', 'science-environment', 'technology'],
  'bbc.co.uk': ['business', 'science-environment', 'technology'],
  'cnn.com': ['business', 'tech', 'health'],
  'reuters.com': ['business', 'markets', 'technology', 'sustainability'],
  'bloomberg.com': ['markets', 'technology', 'companies', 'politics'],
};

function extractSection(url: URL): string | null {
  const path = url.pathname.toLowerCase();
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? parts[0] : null;
}

function hardExclude(brand: Brand, title: string, body: string, url: URL): boolean {
  const txt = `${title}\n${body}`;
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  
  // Brand-specific disambiguation rules
  if (brand.name === "Gillette") {
    // Exclude stadium, location, or person references
    if (/\b(stadium|gillette\s+ma|gillette\s+wyoming|gillette\s*,\s*ma)/i.test(txt)) {
      return true;
    }
    // Exclude if it's clearly about the person not the company
    if (/\bdaniel\s+gillette\b/i.test(txt) && !/\brazor|shav(e|ing)|procter|p&g\b/i.test(txt)) {
      return true;
    }
  }
  
  // Per-brand custom exclusions via monitoring_config
  const cfg = brand.monitoring_config || {};
  if (Array.isArray(cfg.exclude_regex) && cfg.exclude_regex.length > 0) {
    for (const pat of cfg.exclude_regex) {
      try {
        if (new RegExp(pat, 'i').test(txt)) return true;
      } catch (e) {
        console.warn(`Invalid regex pattern for brand ${brand.name}: ${pat}`, e);
      }
    }
  }

  // Domain-level allow/block lists from brand config
  if (cfg.block_domains?.includes(hostname)) return true;
  if (cfg.allow_domains?.length && !cfg.allow_domains.includes(hostname)) return true;

  // Universal section filtering for major news sites
  const allowedSections = SITE_SECTIONS[hostname];
  if (allowedSections) {
    const section = extractSection(url);
    if (section && !allowedSections.includes(section)) {
      return true;
    }
  }
  
  return false;
}

function brandConfigPass(brand: Brand, title: string, body: string): boolean {
  const cfg = (brand as any).monitoring_config || {};
  const hay = (title + ' ' + body).toLowerCase();
  if (Array.isArray(cfg.exclude_regex) && cfg.exclude_regex.some((pat: string) => new RegExp(pat, 'i').test(hay))) return false;
  if (Array.isArray(cfg.require_terms) && cfg.require_terms.length > 0) {
    if (!cfg.require_terms.some((t: string) => hay.includes(String(t).toLowerCase()))) return false;
  }
  return true;
}

// Normalize text for matching (remove accents, normalize unicode)
function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function scoreRelevanceStrict(brand: Brand, title: string, body: string, url: URL): { score: number; reason: string } {
  if (hardExclude(brand, title, body, url)) return { score: 0, reason: 'hard_exclude' };

  const cfg = (brand as any).monitoring_config || {};
  const minScore = typeof cfg.min_score === 'number' ? cfg.min_score : 0.5;

  // Normalize brand names and aliases for matching (removes accents)
  const aliases = [brand.name, ...(brand.aliases ?? [])].map((a) => {
    const normalized = normalize(a);
    return new RegExp(`\\b${ESC(normalized)}\\b`, 'i');
  });
  
  // Normalize text for matching
  const titleNorm = normalize(title);
  const textLead = body.slice(0, 500);
  const leadNorm = normalize(textLead);

  let s = 0;
  const reasons: string[] = [];

  const titleHit = aliases.some((re) => re.test(titleNorm));
  const leadHit = aliases.some((re) => re.test(leadNorm));
  const context = BUSINESS.test(title) || BUSINESS.test(textLead);
  const proxHit = aliases.some((re) => windowHit(`${titleNorm} ${leadNorm}`, re, 8));

  if (titleHit) {
    s += 7;
    reasons.push('title_match');
  }
  if (leadHit) {
    s += 4;
    reasons.push('lead_match');
  }
  if (context) {
    s += 3;
    reasons.push('business_context');
  }
  if (proxHit) {
    s += 3;
    reasons.push('proximity_8');
  }

  // Light penalty if brand mentioned but no business context (reduced from -6 to -2)
  if ((titleHit || leadHit) && !context) {
    s -= 2;
    reasons.push('no_business_penalty');
  }

  const score = Math.max(0, Math.min(20, s));
  return { score, reason: reasons.join('|') || 'no_match' };
}

// ---- category using event_rules --------------------------------------------
// Map new category codes to old categories for backward compatibility
function mapCategoryCodeToOldCategory(code: string): 'labor'|'environment'|'politics'|'social'|'general' {
  if (!code) return 'general';
  
  const prefix = code.split('.')[0];
  switch (prefix) {
    case 'LABOR': return 'labor';
    case 'ESG':
    case 'REGULATORY':
      return 'environment';
    case 'LEGAL':
    case 'POLICY':
      return 'politics';
    case 'FIN':
    case 'PRODUCT':
      return 'social';
    default:
      return 'general';
  }
}

// New async category classifier using event_rules
async function classifyCategory(
  supabase: any,
  domain: string, 
  path: string, 
  title: string, 
  body: string
): Promise<{ category: string; category_code: string; matched_rule?: string }> {
  try {
    const { data, error } = await supabase.rpc('test_article_categorization', {
      p_domain: domain || '',
      p_path: path || '',
      p_title: title,
      p_body: body || ''
    });

    if (error) {
      console.error('[classifyCategory] Error calling test_article_categorization:', error);
      return { category: 'general', category_code: 'general' };
    }

    if (data && data.length > 0) {
      const result = data[0];
      return {
        category_code: result.category_code,
        category: mapCategoryCodeToOldCategory(result.category_code),
        matched_rule: result.matched_rule_id
      };
    }

    // No match - default to general
    console.log(`[classifyCategory] No rules matched for: ${title.slice(0, 60)}`);
    return { category: 'general', category_code: 'general' };
  } catch (err) {
    console.error('[classifyCategory] Exception:', err);
    return { category: 'general', category_code: 'general' };
  }
}

// ---- orientation & impact  (-5..+5) ---------------------------------------
function orientationImpact(title: string): number {
  const t = title.toLowerCase();
  const bad = /\b(violation|lawsuit|fine|penalty|recall|toxic|spill|boycott|strike|layoff|probe|investigation|ban)\b/;
  const good = /\b(award|recognition|certification|sustainab|donation|volunteer|partnership|initiative|improv(e|ement))\b/;
  if (bad.test(t)) return -3;
  if (good.test(t)) return +2;
  return 0;
}

function verificationWeight(v?: string): number {
  if (v === 'official') return 1.4;
  if (v === 'corroborated') return 1.15;
  return 1.0;
}

function recencyWeight(isoDate: string): number {
  const d = new Date(isoDate).getTime();
  const age = Date.now() - d;
  const day = 86400000;
  if (age <= 30*day) return 1.0;
  if (age <= 90*day) return 0.7;
  if (age <= 365*day) return 0.4;
  return 0.2;
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
  // Note: GDELT parse doesn't have supabase client, will classify later in main loop
  
  return {
    title,
    summary: "",
    url: i.url,
    published_at: publishedAt,
    source_name: i.domain ?? urlObj.hostname
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
      source_name: "The Guardian"
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
      source_name: a.source?.name || "NewsAPI"
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
      source_name: "The New York Times"
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
      source_name: a.source?.name || "GNews"
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
      source_name: a.source || "Mediastack"
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
      source_name: a.author || "Currents"
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
        .select("id,name,aliases,ticker,newsroom_domains,monitoring_config")
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
        newsroom_domains: b.newsroom_domains || [],
        monitoring_config: (b as any).monitoring_config || null
      }));
      console.log(`[Orchestrator] Found brand: ${brands[0]?.name || 'none'}`);
    } else {
      console.log("[Orchestrator] Fetching active brands (no specific brand_id)");
      const { data, error: brandsError } = await supabase
        .from("brands")
        .select("id,name,aliases,ticker,newsroom_domains,monitoring_config")
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
        newsroom_domains: b.newsroom_domains || [],
        monitoring_config: (b as any).monitoring_config || null
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
        const title = article.title ?? '';
        const body = article.summary ?? '';
        const occurred = article.published_at;
        const urlCanon = canonicalize(article.url);
        const urlHash = await sha1(urlCanon);
        const urlObj = new URL(urlCanon);
        
        // Language filter: skip non-English articles
        if (nonAsciiRatio(title) > 0.35) {
          totalSkipped++;
          console.log(`[orchestrator] Skipped non-English: ${title.substring(0, 60)}`);
          continue;
        }
        
        // Per-brand config (require/exclude terms)
        if (!brandConfigPass(b, title, body)) {
          totalSkipped++;
          continue;
        }
        
        // Score relevance (context + proximity + section-aware)
        const { score: rel, reason: relReason } = scoreRelevanceStrict(b, title, body, urlObj);
        if (rel < 11) {
          console.log(`[orchestrator] Skipping low-relevance article (rel=${rel}, reason=${relReason}): ${title.slice(0, 80)}`);
          totalSkipped++;
          continue; // DROP low relevance noise
        }
        
        // Deterministic event_id from brand + url so re-runs are idempotent
        const eventIdHash = await sha1(`${b.id}:${urlHash}`);
        const eventId = hashToUuid(eventIdHash);
        const url = new URL(urlCanon);
        
        // Classify category using event_rules
        const domainName = url.hostname.replace(/^www\./, '');
        const categoryResult = await classifyCategory(supabase, domainName, url.pathname, title, body);
        
        console.log(`[Orchestrator] Classified "${title.slice(0, 50)}..." as ${categoryResult.category_code} (old: ${categoryResult.category})`);
        
        // Calculate impact and confidence
        const baseImpact = orientationImpact(title);
        const vW = verificationWeight('unverified');
        const rW = recencyWeight(occurred);
        let finalImpact = Math.round(baseImpact * vW * rW);
        const isPressRelease = /(^|\.)generalmills\.com$/i.test(url.hostname);
        
        // Dampen press releases: cap positive impact
        if (isPressRelease && finalImpact > 1) {
          finalImpact = 1;
        }
        
        const confidence = Math.round(70 * rW * (vW / 1.4));
        
        // Determine orientation
        let orientation: 'positive' | 'negative' | 'mixed' = 'mixed';
        if (baseImpact < -1) orientation = 'negative';
        else if (baseImpact > 1) orientation = 'positive';

        console.log(`[Orchestrator] Processing ${b.name}: ${title.slice(0, 50)}... (rel=${rel}, cat=${categoryResult.category_code}, impact=${finalImpact})`);

        // Canary: detect if rel looks normalized (should never happen)
        if (rel <= 1 && rel !== 0) {
          console.warn('[CANARY] relRaw looks normalized (0-1):', { rel, title: title.slice(0, 50), brand: b.name });
        }
        
        // Use raw score for gating (0-20 scale)
        const isIrrelevant = rel < RELEVANCE_MIN_ACCEPTED;

        // 1) Upsert brand_events first (so FK exists)
        const { error: evErr } = await supabase
          .from("brand_events")
          .upsert({
            event_id: eventId,
            brand_id: b.id,
            title: title.slice(0, 512),
            event_date: occurred,
            occurred_at: occurred,
            source_url: urlCanon,
            category: categoryResult.category, // old field for backward compat
            verification: 'unverified',
            category_code: categoryResult.category_code, // NEW: using event_rules!
            orientation,
            disambiguation_reason: relReason,
            relevance_score_raw: rel, // Raw score (0-20 integer)
            relevance_reason: relReason,
            is_irrelevant: isIrrelevant,
            impact_confidence: confidence,
            is_press_release: isPressRelease,
            impact_labor:       categoryResult.category === 'labor'       ? finalImpact : 0,
            impact_environment: categoryResult.category === 'environment' ? finalImpact : 0,
            impact_politics:    categoryResult.category === 'politics'    ? finalImpact : 0,
            impact_social:      categoryResult.category === 'social'      ? finalImpact : 0,
          }, { onConflict: 'event_id' });

        if (evErr) {
          console.error(`[Event] Upsert error for ${b.name}:`, evErr);
          continue;
        }

        // 2) Upsert event_sources and link it via event_id
        const domain = url.hostname;
        const { error: srcErr, data: srcData } = await supabase
          .from("event_sources")
          .upsert({
            canonical_url: urlCanon,
            canonical_url_hash: urlHash,
            source_name: article.source_name,
            registrable_domain: domain,
            title: title,
            source_date: occurred,
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