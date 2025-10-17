// Unified real ingestion: GDELT + Guardian + NewsAPI + NYT + GNews -> brand_events + event_sources (dedup by URL hash)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

type Brand = { id: string; name: string };
type GdeltItem = { url: string; title: string; seendate: string; domain?: string };
type NewsArticle = { title: string; summary: string; url: string; published_at: string; source_name: string; category: "social" | "general" };

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

function categorize(text: string): "social" | "general" {
  const lower = text.toLowerCase();
  const socialKw = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy", "discrimination"];
  return socialKw.some(k => lower.includes(k)) ? "social" : "general";
}

async function fetchGDELT(brandName: string, max: number): Promise<NewsArticle[]> {
  const q = encodeURIComponent(`"${brandName}"`);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=ArtList&maxrecords=${max}&format=json&timelang=eng&timespan=7d`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GDELT: ${res.status}`);
  const gd = await res.json();
  const items: GdeltItem[] = gd?.articles ?? [];
  return items.map(i => ({
    title: i.title ?? `News: ${brandName}`,
    summary: "",
    url: i.url,
    published_at: i.seendate ? new Date(i.seendate).toISOString() : new Date().toISOString(),
    source_name: i.domain ?? new URL(i.url).hostname,
    category: "general" as const
  }));
}

async function fetchGuardian(apiKey: string, brandName: string): Promise<NewsArticle[]> {
  const searchQuery = `${brandName} AND (${QUERY_TERMS})`;
  const url = new URL("https://content.guardianapis.com/search");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("show-fields", "headline,trailText,bodyText");
  url.searchParams.set("page-size", "10");
  url.searchParams.set("order-by", "newest");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Guardian: ${res.status}`);
  const data = await res.json();
  const results = data.response?.results || [];
  return results.map((a: any) => ({
    title: a.fields?.headline || a.webTitle,
    summary: a.fields?.trailText || a.fields?.bodyText?.slice(0, 300) || "",
    url: a.webUrl,
    published_at: a.webPublicationDate,
    source_name: "The Guardian",
    category: categorize(`${a.webTitle} ${a.fields?.trailText || ""}`)
  }));
}

async function fetchNewsAPI(apiKey: string, brandName: string): Promise<NewsArticle[]> {
  const searchQuery = `${brandName} AND (${QUERY_TERMS})`;
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("language", "en");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`NewsAPI: ${res.status}`);
  const data = await res.json();
  const articles = data.articles || [];
  return articles.map((a: any) => ({
    title: a.title,
    summary: a.description || a.content?.slice(0, 300) || "",
    url: a.url,
    published_at: a.publishedAt,
    source_name: a.source?.name || "NewsAPI",
    category: categorize(`${a.title} ${a.description || ""}`)
  }));
}

async function fetchNYTimes(apiKey: string, brandName: string): Promise<NewsArticle[]> {
  const searchQuery = `${brandName} AND (${QUERY_TERMS})`;
  const url = new URL("https://api.nytimes.com/svc/search/v2/articlesearch.json");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("sort", "newest");
  url.searchParams.set("fl", "headline,abstract,web_url,pub_date");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`NYT: ${res.status}`);
  const data = await res.json();
  const docs = data.response?.docs || [];
  return docs.map((a: any) => ({
    title: a.headline?.main || "",
    summary: a.abstract || "",
    url: a.web_url,
    published_at: a.pub_date,
    source_name: "The New York Times",
    category: categorize(`${a.headline?.main || ""} ${a.abstract || ""}`)
  }));
}

async function fetchGNews(apiKey: string, brandName: string): Promise<NewsArticle[]> {
  const searchQuery = `${brandName} AND (${QUERY_TERMS})`;
  const url = new URL("https://gnews.io/api/v4/search");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("token", apiKey);
  url.searchParams.set("lang", "en");
  url.searchParams.set("max", "10");
  url.searchParams.set("sortby", "publishedAt");
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`GNews: ${res.status}`);
  const data = await res.json();
  const articles = data.articles || [];
  return articles.map((a: any) => ({
    title: a.title,
    summary: a.description || a.content?.slice(0, 300) || "",
    url: a.url,
    published_at: a.publishedAt,
    source_name: a.source?.name || "GNews",
    category: categorize(`${a.title} ${a.description || ""}`)
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const brandId = url.searchParams.get("brand_id");
  const max = parseInt(url.searchParams.get("max") || "20");

  try {
    let brands: Brand[] = [];
    if (brandId) {
      const { data } = await supabase.from("brands").select("id,name").eq("id", brandId).limit(1);
      brands = data ?? [];
    } else {
      const { data } = await supabase.from("brands").select("id,name").eq("is_active", true).limit(10);
      brands = data ?? [];
    }

    const guardianKey = Deno.env.get("GUARDIAN_API_KEY");
    const newsApiKey = Deno.env.get("NEWSAPI_KEY");
    const nytKey = Deno.env.get("NYT_API_KEY");
    const gnewsKey = Deno.env.get("GNEWS_API_KEY");

    console.log(`[Unified Orchestrator] Processing ${brands.length} brands with all sources`);

    let totalInserted = 0;
    let totalSkipped = 0;

    for (const b of brands) {
      console.log(`[Orchestrator] Processing brand: ${b.name}`);
      const allArticles: NewsArticle[] = [];

      // Fetch from all sources
      try {
        const gdeltArticles = await fetchGDELT(b.name, max);
        allArticles.push(...gdeltArticles);
        console.log(`[GDELT] Fetched ${gdeltArticles.length} articles`);
      } catch (e) {
        console.error("[GDELT] Error:", e);
      }

      if (guardianKey) {
        try {
          const guardianArticles = await fetchGuardian(guardianKey, b.name);
          allArticles.push(...guardianArticles);
          console.log(`[Guardian] Fetched ${guardianArticles.length} articles`);
        } catch (e) {
          console.error("[Guardian] Error:", e);
        }
      }

      if (newsApiKey) {
        try {
          const newsApiArticles = await fetchNewsAPI(newsApiKey, b.name);
          allArticles.push(...newsApiArticles);
          console.log(`[NewsAPI] Fetched ${newsApiArticles.length} articles`);
        } catch (e) {
          console.error("[NewsAPI] Error:", e);
        }
      }

      if (nytKey) {
        try {
          const nytArticles = await fetchNYTimes(nytKey, b.name);
          allArticles.push(...nytArticles);
          console.log(`[NYT] Fetched ${nytArticles.length} articles`);
        } catch (e) {
          console.error("[NYT] Error:", e);
        }
      }

      if (gnewsKey) {
        try {
          const gnewsArticles = await fetchGNews(gnewsKey, b.name);
          allArticles.push(...gnewsArticles);
          console.log(`[GNews] Fetched ${gnewsArticles.length} articles`);
        } catch (e) {
          console.error("[GNews] Error:", e);
        }
      }

      console.log(`[Orchestrator] Total ${allArticles.length} articles fetched for ${b.name}`);

      for (const article of allArticles) {
        const urlCanon = canonicalize(article.url);
        const urlHash = await sha1(urlCanon);

        // Check for duplicate URL
        const { data: existingSrc } = await supabase
          .from("event_sources")
          .select("id,event_id")
          .eq("canonical_url_hash", urlHash)
          .maybeSingle();

        if (existingSrc?.id) {
          totalSkipped++;
          continue;
        }

        // Insert event first
        const eventId = crypto.randomUUID();
        const { error: evErr } = await supabase
          .from("brand_events")
          .insert({
            event_id: eventId,
            brand_id: b.id,
            event_date: article.published_at,
            occurred_at: article.published_at,
            category: article.category,
            verification: "corroborated",
            title: article.title.slice(0, 512),
            description: article.summary.slice(0, 1000),
            is_test: false
          });

        if (evErr) {
          console.error("[Event] Insert error:", evErr);
          continue;
        }

        // Then insert source
        const { error: srcErr } = await supabase
          .from("event_sources")
          .insert({
            event_id: eventId,
            canonical_url: urlCanon,
            canonical_url_hash: urlHash,
            source_name: article.source_name,
            registrable_domain: new URL(urlCanon).hostname,
            title: article.title,
            source_date: article.published_at,
            is_primary: true
          });

        if (!srcErr) {
          totalInserted++;
        } else {
          console.error("[Source] Insert error:", srcErr);
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