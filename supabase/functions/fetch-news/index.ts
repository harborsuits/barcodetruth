import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Inline simplified adapters (mirror client-side logic)
interface NewsArticle {
  title: string;
  summary: string;
  url: string;
  published_at: string;
  source_name: string;
  category: "social" | "general";
  raw_data: Record<string, any>;
}

async function fetchGuardian(apiKey: string, brandName: string): Promise<NewsArticle[]> {
  const query = "lawsuit OR recall OR boycott OR scandal OR controversy";
  const searchQuery = `${brandName} AND (${query})`;
  const url = new URL("https://content.guardianapis.com/search");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("show-fields", "headline,trailText,bodyText");
  url.searchParams.set("page-size", "10");
  url.searchParams.set("order-by", "newest");

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Guardian API error: ${response.status}`);

  const data = await response.json();
  const results = data.response?.results || [];

  return results.map((article: any) => {
    const text = `${article.webTitle} ${article.fields?.trailText || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy"];
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
  const query = "lawsuit OR recall OR boycott OR scandal OR controversy";
  const searchQuery = `${brandName} AND (${query})`;
  const url = new URL("https://newsapi.org/v2/everything");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("sortBy", "publishedAt");
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("language", "en");

  const response = await fetch(url.toString());
  if (!response.ok) {
    if (response.status === 429) throw new Error("NewsAPI rate limit exceeded");
    throw new Error(`NewsAPI error: ${response.status}`);
  }

  const data = await response.json();
  const articles = data.articles || [];

  return articles.map((article: any) => {
    const text = `${article.title} ${article.description || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy"];
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
  const query = "lawsuit OR recall OR boycott OR scandal OR controversy";
  const searchQuery = `${brandName} AND (${query})`;
  const url = new URL("https://api.nytimes.com/svc/search/v2/articlesearch.json");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("api-key", apiKey);
  url.searchParams.set("sort", "newest");
  url.searchParams.set("fl", "headline,abstract,web_url,pub_date,source,lead_paragraph");

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`NYTimes API error: ${response.status}`);

  const data = await response.json();
  const docs = data.response?.docs || [];

  return docs.map((article: any) => {
    const text = `${article.headline?.main || ""} ${article.abstract || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy"];
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
  const query = "lawsuit OR recall OR boycott OR scandal OR controversy";
  const searchQuery = `${brandName} AND (${query})`;
  const url = new URL("https://gnews.io/api/v4/search");
  url.searchParams.set("q", searchQuery);
  url.searchParams.set("token", apiKey);
  url.searchParams.set("lang", "en");
  url.searchParams.set("max", "10");
  url.searchParams.set("sortby", "publishedAt");

  const response = await fetch(url.toString());
  if (!response.ok) {
    if (response.status === 429) throw new Error("GNews rate limit exceeded");
    throw new Error(`GNews API error: ${response.status}`);
  }

  const data = await response.json();
  const articles = data.articles || [];

  return articles.map((article: any) => {
    const text = `${article.title} ${article.description || ""}`.toLowerCase();
    const socialKeywords = ["lawsuit", "recall", "boycott", "protest", "scandal", "controversy"];
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    // Fetch pilot brands to monitor
    const { data: pilotBrands, error: brandsError } = await supabase
      .from("pilot_brands")
      .select("brand_id, brands(name)")
      .limit(10);

    if (brandsError) throw brandsError;

    let totalArticles = 0;
    let jobsCreated = 0;

    for (const pilot of pilotBrands || []) {
      const brandName = (pilot.brands as any)?.name;
      if (!brandName) continue;

      const allArticles: NewsArticle[] = [];

      // Fetch from Guardian
      if (guardianKey) {
        try {
          const articles = await fetchGuardian(guardianKey, brandName);
          allArticles.push(...articles);
          console.log(`Fetched ${articles.length} articles from Guardian for ${brandName}`);
        } catch (err) {
          console.error(`Guardian fetch error for ${brandName}:`, err);
        }
      }

      // Fetch from NewsAPI
      if (newsApiKey) {
        try {
          const articles = await fetchNewsAPI(newsApiKey, brandName);
          allArticles.push(...articles);
          console.log(`Fetched ${articles.length} articles from NewsAPI for ${brandName}`);
        } catch (err) {
          console.error(`NewsAPI fetch error for ${brandName}:`, err);
        }
      }

      // Fetch from NYTimes
      if (nytKey) {
        try {
          const articles = await fetchNYTimes(nytKey, brandName);
          allArticles.push(...articles);
          console.log(`Fetched ${articles.length} articles from NYTimes for ${brandName}`);
        } catch (err) {
          console.error(`NYTimes fetch error for ${brandName}:`, err);
        }
      }

      // Fetch from GNews
      if (gnewsKey) {
        try {
          const articles = await fetchGNews(gnewsKey, brandName);
          allArticles.push(...articles);
          console.log(`Fetched ${articles.length} articles from GNews for ${brandName}`);
        } catch (err) {
          console.error(`GNews fetch error for ${brandName}:`, err);
        }
      }

      totalArticles += allArticles.length;

      // Dedupe by URL
      const { data: existingEvents } = await supabase
        .from("brand_events")
        .select("source_url")
        .eq("brand_id", pilot.brand_id)
        .in("source_url", allArticles.map(a => a.url));

      const existingUrls = new Set((existingEvents || []).map(e => e.source_url));
      const newArticles = allArticles.filter(a => !existingUrls.has(a.url));

      // Create ingestion jobs
      for (const article of newArticles) {
        const { error: jobError } = await supabase.from("jobs").insert({
          stage: "ingest_event",
          payload: {
            brand_id: pilot.brand_id,
            title: article.title,
            description: article.summary,
            source_url: article.url,
            occurred_at: article.published_at,
            category: article.category,
            source_name: article.source_name,
            raw_data: article.raw_data,
          },
        });

        if (!jobError) jobsCreated++;
      }

      console.log(`Created ${newArticles.length} jobs for ${brandName}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        brands_processed: pilotBrands?.length || 0,
        articles_fetched: totalArticles,
        jobs_created: jobsCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in fetch-news:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
