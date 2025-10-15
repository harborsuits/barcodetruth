import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parse } from "https://esm.sh/tldts@6.1.9";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helpers (exported for testing)
export const normalizeUrl = (raw: string) => {
  try {
    const u = new URL(raw);
    // strip common tracking noise
    u.search = '';
    u.hash = '';
    // normalize hostname to lowercase to avoid case duplicates
    u.hostname = u.hostname.toLowerCase();
    // remove trailing slash
    return u.toString().replace(/\/$/, '');
  } catch {
    return raw;
  }
};

// URL canonicalization for deduplication
function canonicalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'mc_cid', 'mc_eid', 'msclkid', '_ga'];
    trackingParams.forEach(p => url.searchParams.delete(p));
    const sortedParams = [...url.searchParams.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
    url.search = sortedParams ? `?${sortedParams}` : '';
    url.pathname = url.pathname.replace(/^\/amp\/?/, '/').replace(/\/amp\/?$/, '/');
    if (url.pathname !== '/' && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch { return u; }
}

function registrableDomain(u: string): string | null {
  try {
    const parsed = parse(u);
    return parsed.domain || null;
  } catch { return null; }
}

function textFingerprint(title: string, snippet?: string): string {
  const str = `${title} ${snippet || ''}`.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = str.split(/\s+/).filter(Boolean);
  const top = tokens.slice(0, 30).join(' ');
  let h = BigInt('14695981039346656037');
  for (let i = 0; i < top.length; i++) {
    h ^= BigInt(top.charCodeAt(i));
    h *= BigInt('1099511628211');
  }
  return h.toString(16);
}

async function enrichSourceOwnership(supabase: any, sourceId: string, url: string, title?: string, snippet?: string, sourceDate?: string) {
  const domain = registrableDomain(url);
  const canonical = canonicalizeUrl(url);
  const fp = textFingerprint(title || '', snippet);
  const dayBucket = sourceDate ? new Date(sourceDate).toISOString().slice(0, 10) : null;

  let owner = 'Unknown';
  let kind = 'publisher';
  
  if (domain) {
    const { data: org } = await supabase.from('news_orgs').select('owner, kind').eq('domain', domain).maybeSingle();
    if (org) {
      owner = org.owner;
      kind = org.kind;
    }
  }

  await supabase.from('event_sources').update({
    canonical_url: canonical,
    registrable_domain: domain,
    domain_owner: owner,
    domain_kind: kind,
    title_fp: fp,
    day_bucket: dayBucket
  }).eq('id', sourceId);
}

export const fetchWithTimeout = (url: string, timeoutMs = 8000, init?: RequestInit) => {
  return Promise.race([
    fetch(url, init),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]) as Promise<Response>;
};

interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  published_at: string;
  source_name: string;
  category: "social" | "general";
  raw_data: Record<string, any>;
}

// Inline adapters for news sources
async function fetchGuardian(apiKey: string, brandName: string): Promise<NewsArticle[]> {
  // Comprehensive query covering labor, environment, politics, social, safety
  const query = [
    // Labor & workplace
    "OSHA", "violation", "safety", "workplace", "worker", "union", "wage", "discrimination", 
    "harassment", "injury", "fatality", "labor", "employee", "fired", "layoff",
    // Environment
    "EPA", "pollution", "emissions", "environmental", "toxic", "waste", "spill", 
    "contamination", "climate", "sustainability", "fine", "penalty",
    // Social & consumer
    "lawsuit", "recall", "boycott", "scandal", "fraud", "deceptive", "settlement",
    "consumer", "data breach", "privacy", "investigation",
    // Politics & governance
    "FEC", "donation", "lobbying", "PAC", "campaign", "political",
    // General accountability
    "allegation", "charged", "accused", "complaint", "regulatory"
  ].join(" OR ");
  
  const searchQuery = `${brandName} AND (${query})`;
  const url = new URL("https://content.guardianapis.com/search");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("show-fields", "headline,trailText,bodyText");
  url.searchParams.set("page-size", "10");
  url.searchParams.set("order-by", "newest");

  const response = await fetchWithTimeout(url.toString(), 8000);
  if (!response.ok) throw new Error(`Guardian API error: ${response.status}`);

  const data = await response.json();
  const results = data.response?.results || [];

  return results.map((article: any) => {
    const text = `${article.webTitle} ${article.fields?.trailText || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy", "discrimination"];
    const category = socialKeywords.some(kw => text.includes(kw)) ? "social" : "general";

    return {
      title: article.fields?.headline || article.webTitle,
      summary: article.fields?.trailText || article.fields?.bodyText?.slice(0, 300) || "",
      url: article.webUrl,
      published_at: article.webPublicationDate,
      source_name: "The Guardian",
      category,
      raw_data: article,
    };
  });
}

async function fetchNewsAPI(apiKey: string, brandName: string): Promise<NewsArticle[]> {
  const query = [
    "OSHA", "violation", "safety", "workplace", "worker", "union", "wage", "discrimination", 
    "harassment", "injury", "fatality", "labor", "employee", "fired", "layoff",
    "EPA", "pollution", "emissions", "environmental", "toxic", "waste", "spill", 
    "contamination", "climate", "sustainability", "fine", "penalty",
    "lawsuit", "recall", "boycott", "scandal", "fraud", "deceptive", "settlement",
    "consumer", "data breach", "privacy", "investigation",
    "FEC", "donation", "lobbying", "PAC", "campaign", "political",
    "allegation", "charged", "accused", "complaint", "regulatory"
  ].join(" OR ");
  
  const searchQuery = `${brandName} AND (${query})`;
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("language", "en");

  const response = await fetchWithTimeout(url.toString(), 8000);
  if (!response.ok) {
    if (response.status === 429) throw new Error("NewsAPI rate limit exceeded");
    throw new Error(`NewsAPI error: ${response.status}`);
  }

  const data = await response.json();
  const articles = data.articles || [];

  return articles.map((article: any) => {
    const text = `${article.title} ${article.description || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy", "discrimination"];
    const category = socialKeywords.some(kw => text.includes(kw)) ? "social" : "general";

    return {
      title: article.title,
      summary: article.description || article.content?.slice(0, 300) || "",
      url: article.url,
      published_at: article.publishedAt,
      source_name: article.source?.name || "NewsAPI",
      category,
      raw_data: article,
    };
  });
}

async function fetchNYTimes(apiKey: string, brandName: string): Promise<NewsArticle[]> {
  const query = [
    "OSHA", "violation", "safety", "workplace", "worker", "union", "wage", "discrimination", 
    "harassment", "injury", "fatality", "labor", "employee", "fired", "layoff",
    "EPA", "pollution", "emissions", "environmental", "toxic", "waste", "spill", 
    "contamination", "climate", "sustainability", "fine", "penalty",
    "lawsuit", "recall", "boycott", "scandal", "fraud", "deceptive", "settlement",
    "consumer", "data breach", "privacy", "investigation",
    "FEC", "donation", "lobbying", "PAC", "campaign", "political",
    "allegation", "charged", "accused", "complaint", "regulatory"
  ].join(" OR ");
  
  const searchQuery = `${brandName} AND (${query})`;
  const url = new URL("https://api.nytimes.com/svc/search/v2/articlesearch.json");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("sort", "newest");
  url.searchParams.set("fl", "headline,abstract,web_url,pub_date,source,lead_paragraph");

  const response = await fetchWithTimeout(url.toString(), 8000);
  if (!response.ok) throw new Error(`NYTimes API error: ${response.status}`);

  const data = await response.json();
  const docs = data.response?.docs || [];

  return docs.map((article: any) => {
    const text = `${article.headline?.main || ""} ${article.abstract || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy", "discrimination"];
    const category = socialKeywords.some(kw => text.includes(kw)) ? "social" : "general";

    return {
      title: article.headline?.main || "",
      summary: article.abstract || article.lead_paragraph?.slice(0, 300) || "",
      url: article.web_url,
      published_at: article.pub_date,
      source_name: "The New York Times",
      category,
      raw_data: article,
    };
  });
}

async function fetchGNews(apiKey: string, brandName: string): Promise<NewsArticle[]> {
  const query = [
    "OSHA", "violation", "safety", "workplace", "worker", "union", "wage", "discrimination", 
    "harassment", "injury", "fatality", "labor", "employee", "fired", "layoff",
    "EPA", "pollution", "emissions", "environmental", "toxic", "waste", "spill", 
    "contamination", "climate", "sustainability", "fine", "penalty",
    "lawsuit", "recall", "boycott", "scandal", "fraud", "deceptive", "settlement",
    "consumer", "data breach", "privacy", "investigation",
    "FEC", "donation", "lobbying", "PAC", "campaign", "political",
    "allegation", "charged", "accused", "complaint", "regulatory"
  ].join(" OR ");
  
  const searchQuery = `${brandName} AND (${query})`;
  const url = new URL("https://gnews.io/api/v4/search");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("token", apiKey);
  url.searchParams.set("lang", "en");
  url.searchParams.set("max", "10");
  url.searchParams.set("sortby", "publishedAt");

  const response = await fetchWithTimeout(url.toString(), 8000);
  if (!response.ok) {
    if (response.status === 429) throw new Error("GNews rate limit exceeded");
    throw new Error(`GNews API error: ${response.status}`);
  }

  const data = await response.json();
  const articles = data.articles || [];

  return articles.map((article: any) => {
    const text = `${article.title} ${article.description || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy", "discrimination"];
    const category = socialKeywords.some(kw => text.includes(kw)) ? "social" : "general";

    return {
      title: article.title,
      summary: article.description || article.content?.slice(0, 300) || "",
      url: article.url,
      published_at: article.publishedAt,
      source_name: article.source?.name || "GNews",
      category,
      raw_data: article,
    };
  });
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

    const brandId = new URL(req.url).searchParams.get("brand_id");
    const dryrun = new URL(req.url).searchParams.get("dryrun") === "1";
    
    if (dryrun) {
      console.log('[fetch-news-events] 🧪 DRY RUN enabled - no inserts, no push jobs');
    }
    
    if (!brandId) {
      return new Response(JSON.stringify({ error: "brand_id required" }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[fetch-news-events] Fetching news for brand: ${brandId}`);

    // Check feature flag
    const { data: config } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "ingest_news_enabled")
      .maybeSingle();

    if (config?.value === false) {
      console.log("[NEWS] Ingestion disabled via feature flag");
      return new Response(
        JSON.stringify({ 
          success: true, 
          scanned: 0, 
          inserted: 0, 
          skipped: 0, 
          note: "News ingestion disabled" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get brand name for searching
    const { data: brand } = await supabase
      .from('brands')
      .select('name')
      .eq('id', brandId)
      .single();

    if (!brand) {
      console.error('[fetch-news-events] Brand not found');
      return new Response(JSON.stringify({ error: "Brand not found" }), { 
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const guardianKey = Deno.env.get("GUARDIAN_API_KEY");
    const newsApiKey = Deno.env.get("NEWSAPI_KEY");
    const nytKey = Deno.env.get("NYT_API_KEY");
    const gnewsKey = Deno.env.get("GNEWS_API_KEY");

    if (!guardianKey && !newsApiKey && !nytKey && !gnewsKey) {
      return new Response(
        JSON.stringify({ error: "No news API keys configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Circuit breaker state (per-invocation)
    const failures = new Map<string, number>();
    const incFail = (key: string) => failures.set(key, (failures.get(key) || 0) + 1);
    const shouldSkipSource = (key: string) => (failures.get(key) || 0) >= 3;

    // Per-source caps to prevent quota overruns
    const MAX_PER_SOURCE = 10;

    // Fetch from all available sources
    const allArticles: NewsArticle[] = [];
    
    if (guardianKey && !shouldSkipSource('guardian')) {
      try {
        const articles = await fetchGuardian(guardianKey, brand.name);
        const capped = articles.slice(0, MAX_PER_SOURCE);
        allArticles.push(...capped);
        console.log(`[fetch-news-events] Fetched ${capped.length} from Guardian${articles.length > MAX_PER_SOURCE ? ` (capped from ${articles.length})` : ''}`);
      } catch (err) {
        incFail('guardian');
        console.error(`[fetch-news-events] Guardian error (${failures.get('guardian')} fails):`, err);
      }
    }

    if (newsApiKey && !shouldSkipSource('newsapi')) {
      try {
        const articles = await fetchNewsAPI(newsApiKey, brand.name);
        const capped = articles.slice(0, MAX_PER_SOURCE);
        allArticles.push(...capped);
        console.log(`[fetch-news-events] Fetched ${capped.length} from NewsAPI${articles.length > MAX_PER_SOURCE ? ` (capped from ${articles.length})` : ''}`);
      } catch (err) {
        incFail('newsapi');
        console.error(`[fetch-news-events] NewsAPI error (${failures.get('newsapi')} fails):`, err);
      }
    }

    if (nytKey && !shouldSkipSource('nyt')) {
      try {
        const articles = await fetchNYTimes(nytKey, brand.name);
        const capped = articles.slice(0, MAX_PER_SOURCE);
        allArticles.push(...capped);
        console.log(`[fetch-news-events] Fetched ${capped.length} from NYT${articles.length > MAX_PER_SOURCE ? ` (capped from ${articles.length})` : ''}`);
      } catch (err) {
        incFail('nyt');
        console.error(`[fetch-news-events] NYT error (${failures.get('nyt')} fails):`, err);
      }
    }

    if (gnewsKey && !shouldSkipSource('gnews')) {
      try {
        const articles = await fetchGNews(gnewsKey, brand.name);
        const capped = articles.slice(0, MAX_PER_SOURCE);
        allArticles.push(...capped);
        console.log(`[fetch-news-events] Fetched ${capped.length} from GNews${articles.length > MAX_PER_SOURCE ? ` (capped from ${articles.length})` : ''}`);
      } catch (err) {
        incFail('gnews');
        console.error(`[fetch-news-events] GNews error (${failures.get('gnews')} fails):`, err);
      }
    }

    const events = [];
    let scanned = allArticles.length;
    let skipped = 0;

    for (const article of allArticles) {
      const normalizedUrl = normalizeUrl(article.url);

      // Dedupe check by normalized URL
      const { data: existing } = await supabase
        .from('brand_events')
        .select('event_id')
        .eq('brand_id', brandId)
        .eq('source_url', normalizedUrl)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[fetch-news-events] Skipping duplicate: ${normalizedUrl}`);
        skipped++;
        continue;
      }

      // Validate relevance before inserting
      let relevanceScore = 0.5; // Default for dryrun
      let verificationLevel = 'unverified';
      let specificFacts: string[] = [];

      if (!dryrun) {
        try {
          const validationResponse = await supabase.functions.invoke('validate-news-relevance', {
            body: {
              article_url: normalizedUrl,
              article_title: article.title,
              article_summary: article.summary || article.title,
              brand_name: brand.name,
              claimed_category: article.category
            }
          });

          if (validationResponse.data?.success) {
            relevanceScore = validationResponse.data.relevance_score;
            verificationLevel = validationResponse.data.verification_level;
            specificFacts = validationResponse.data.specific_facts || [];

            // Skip if not relevant
            if (relevanceScore < 0.5) {
              console.log(`[fetch-news-events] Skipping low relevance (${relevanceScore}): ${article.title}`);
              console.log(`  Reason: ${validationResponse.data.rejection_reason}`);
              skipped++;
              continue;
            }
          } else {
            console.warn(`[fetch-news-events] Validation failed, using defaults: ${validationResponse.error}`);
          }
        } catch (validationErr) {
          console.error(`[fetch-news-events] Validation error: ${validationErr}`);
          // Continue with defaults rather than blocking
        }
      }

      const event = {
        brand_id: brandId,
        title: article.title,
        description: article.summary || article.title,
        category: article.category,
        event_date: article.published_at,
        verification: verificationLevel as 'official' | 'corroborated' | 'unverified',
        orientation: 'negative',
        impact_social: article.category === 'social' ? -3 : -1,
        source_url: normalizedUrl,
        raw_data: JSON.parse(JSON.stringify({
          ...article.raw_data,
          relevance_score: relevanceScore,
          specific_facts: specificFacts
        })),
      };

      if (dryrun) {
        console.log(`[fetch-news-events] [DRYRUN] Would insert event (relevance: ${relevanceScore}):`, event.title);
        events.push('dryrun-' + article.url);
        continue;
      }

      // Insert event
      const { data: eventData, error: eventError } = await supabase
        .from('brand_events')
        .insert(event)
        .select('event_id')
        .single();

      if (eventError) {
        if (eventError.code === '23505') {
          console.log(`[fetch-news-events] Duplicate detected via constraint: ${article.url}`);
          skipped++;
          continue;
        }
        console.error('[fetch-news-events] Error inserting event:', eventError);
        continue;
      }

      // Insert source for attribution
      const { data: sourceData, error: sourceError } = await supabase
        .from('event_sources')
        .insert({
          event_id: eventData.event_id,
          source_name: article.source_name,
          source_url: normalizedUrl,
          quote: article.summary?.slice(0, 200),
          source_date: article.published_at,
        })
        .select('id')
        .single();

      if (sourceError) {
        console.error('[fetch-news-events] Error inserting source:', sourceError);
      } else {
        events.push(eventData.event_id);
        
        // Enrich source with ownership & normalization data (fire-and-forget)
        if (sourceData?.id) {
          enrichSourceOwnership(supabase, sourceData.id, normalizedUrl, article.title, article.summary, article.published_at)
            .catch(err => console.error('[fetch-news-events] Enrichment error:', err));
        }
      }
    }

    console.log(`[fetch-news-events] Scanned: ${scanned}, Inserted: ${events.length}, Skipped: ${skipped}`);

    // Enqueue coalesced push notification if we created any events
    if (events.length > 0 && !dryrun) {
      const { data: brandRow } = await supabase
        .from('brands')
        .select('id, name')
        .eq('id', brandId)
        .maybeSingle();

      const bucketSec = Math.floor(Date.now() / (5 * 60 * 1000)) * 5 * 60;
      const coalesceKey = `${brandId}:${bucketSec}`;

      const nowISO = new Date().toISOString();
      const payload = {
        brand_id: brandId,
        brand_name: brandRow?.name ?? brandId,
        at: nowISO,
        events: [
          {
            category: 'social',
            delta: -1 * events.length,
          },
        ],
      };

      const { error: upsertErr } = await supabase.rpc('upsert_coalesced_job', {
        p_stage: 'send_push_for_score_change',
        p_key: coalesceKey,
        p_payload: payload,
        p_not_before: nowISO,
      });

      if (upsertErr) {
        console.error('[fetch-news-events] Failed to enqueue coalesced job:', upsertErr);
      } else {
        console.log(
          `[fetch-news-events] Enqueued coalesced job for ${brandRow?.name ?? brandId} (inserted=${events.length})`
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        dryrun,
        scanned,
        inserted: events.length,
        skipped,
        event_ids: events 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error('[fetch-news-events] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
