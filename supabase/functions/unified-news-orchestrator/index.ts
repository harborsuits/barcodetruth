import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// News source configurations
const NEWS_SOURCES = {
  guardian: {
    name: "The Guardian",
    rateLimit: { calls: 100, windowMs: 3600000 },
    categories: ['labor', 'environment'],
    priority: 1,
  },
  newsapi: {
    name: "NewsAPI",
    rateLimit: { calls: 100, windowMs: 86400000 }, // daily
    categories: ['labor', 'environment'],
    priority: 2,
  },
  nyt: {
    name: "NY Times",
    rateLimit: { calls: 500, windowMs: 86400000 },
    categories: ['labor', 'environment'],
    priority: 2,
  },
  gnews: {
    name: "GNews",
    rateLimit: { calls: 100, windowMs: 86400000 },
    categories: ['labor', 'environment'],
    priority: 3,
  },
};

// Unified keyword definitions
const CATEGORY_KEYWORDS = {
  labor: {
    required: ['layoff', 'union', 'strike', 'workplace', 'wage', 'employee', 'worker', 'labor', 'fired', 'injury', 'safety', 'OSHA', 'discrimination', 'harassment'],
    negative: ['stock', 'investor', 'market', 'earnings'],
  },
  environment: {
    required: ['pollution', 'environmental', 'EPA', 'emissions', 'toxic', 'waste', 'spill', 'contamination', 'climate', 'sustainability'],
    negative: ['financial', 'stock', 'investor'],
  },
};

// Severity indicators
const SEVERITY_KEYWORDS = {
  severe: ['lawsuit', 'sued', 'death', 'fatal', 'killed', 'criminal', 'illegal', 'banned', 'shutdown', 'catastrophic'],
  moderate: ['fine', 'penalty', 'violation', 'complaint', 'investigation', 'accused', 'alleged'],
  minor: ['review', 'audit', 'inspection', 'inquiry', 'assessment'],
};

interface NewsArticle {
  title: string;
  snippet: string;
  url: string;
  publishedAt: string;
  source: string;
}

// Timeout wrapper
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// Fetch Guardian articles
async function fetchGuardian(brandName: string, apiKey: string): Promise<NewsArticle[]> {
  const query = [
    'layoff', 'union', 'strike', 'workplace', 'OSHA', 'pollution', 'EPA', 'emissions', 
    'lawsuit', 'violation', 'fine', 'penalty', 'investigation'
  ].join(' OR ');
  
  const url = new URL('https://content.guardianapis.com/search');
  url.searchParams.set('q', `${brandName} AND (${query})`);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('page-size', '20');
  url.searchParams.set('order-by', 'newest');
  url.searchParams.set('show-fields', 'headline,trailText,bodyText');

  const response = await fetchWithTimeout(url.toString(), {});
  if (!response.ok) throw new Error(`Guardian API error: ${response.status}`);

  const data = await response.json();
  const results = data?.response?.results || [];

  return results.map((article: any) => ({
    title: article.webTitle || article.fields?.headline || '',
    snippet: article.fields?.trailText || article.fields?.bodyText?.substring(0, 300) || '',
    url: article.webUrl,
    publishedAt: article.webPublicationDate,
    source: 'guardian',
  }));
}

// Fetch NewsAPI articles
async function fetchNewsAPI(brandName: string, apiKey: string): Promise<NewsArticle[]> {
  const query = [
    'labor', 'layoff', 'union', 'strike', 'workplace', 'OSHA', 
    'environment', 'EPA', 'pollution', 'emissions', 'lawsuit', 'violation'
  ].join(' OR ');

  const url = new URL('https://newsapi.org/v2/everything');
  url.searchParams.set('q', `${brandName} AND (${query})`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('language', 'en');
  url.searchParams.set('sortBy', 'publishedAt');
  url.searchParams.set('pageSize', '20');

  const response = await fetchWithTimeout(url.toString(), {});
  if (!response.ok) throw new Error(`NewsAPI error: ${response.status}`);

  const data = await response.json();
  const articles = data.articles || [];

  return articles.map((article: any) => ({
    title: article.title,
    snippet: article.description || article.content?.substring(0, 300) || '',
    url: article.url,
    publishedAt: article.publishedAt,
    source: 'newsapi',
  }));
}

// Fetch NY Times articles
async function fetchNYTimes(brandName: string, apiKey: string): Promise<NewsArticle[]> {
  const query = [
    'labor', 'layoff', 'union', 'strike', 'workplace', 'OSHA', 
    'environment', 'EPA', 'pollution', 'emissions', 'lawsuit', 'violation'
  ].join(' OR ');

  const url = new URL('https://api.nytimes.com/svc/search/v2/articlesearch.json');
  url.searchParams.set('q', `${brandName} AND (${query})`);
  url.searchParams.set('api-key', apiKey);
  url.searchParams.set('sort', 'newest');
  url.searchParams.set('fl', 'headline,abstract,web_url,pub_date');

  const response = await fetchWithTimeout(url.toString(), {});
  if (!response.ok) throw new Error(`NYT error: ${response.status}`);

  const data = await response.json();
  const docs = data.response?.docs || [];

  return docs.map((article: any) => ({
    title: article.headline?.main || '',
    snippet: article.abstract || article.lead_paragraph?.substring(0, 300) || '',
    url: article.web_url,
    publishedAt: article.pub_date,
    source: 'nyt',
  }));
}

// Fetch GNews articles
async function fetchGNews(brandName: string, apiKey: string): Promise<NewsArticle[]> {
  const query = [
    'labor', 'layoff', 'union', 'strike', 'workplace', 'OSHA', 
    'environment', 'EPA', 'pollution', 'emissions', 'lawsuit', 'violation'
  ].join(' OR ');

  const url = new URL('https://gnews.io/api/v4/search');
  url.searchParams.set('q', `${brandName} AND (${query})`);
  url.searchParams.set('token', apiKey);
  url.searchParams.set('lang', 'en');
  url.searchParams.set('max', '20');
  url.searchParams.set('sortby', 'publishedAt');

  const response = await fetchWithTimeout(url.toString(), {});
  if (!response.ok) throw new Error(`GNews error: ${response.status}`);

  const data = await response.json();
  const articles = data.articles || [];

  return articles.map((article: any) => ({
    title: article.title,
    snippet: article.description || article.content?.substring(0, 300) || '',
    url: article.url,
    publishedAt: article.publishedAt,
    source: 'gnews',
  }));
}

// Detect category from text
function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const hasRequired = keywords.required.some(kw => lower.includes(kw.toLowerCase()));
    const hasNegative = keywords.negative.some(kw => lower.includes(kw.toLowerCase()));
    
    if (hasRequired && !hasNegative) {
      return category;
    }
  }
  
  return null;
}

// Detect severity
function detectSeverity(text: string): string {
  const lower = text.toLowerCase();
  
  for (const [level, keywords] of Object.entries(SEVERITY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return level;
    }
  }
  
  return 'minor';
}

// Calculate title similarity (Jaccard index)
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  
  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

// Main handler
export default serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const brandId = url.searchParams.get('brand_id');
    const dryRun = url.searchParams.get('dryrun') === '1';

    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brand_id required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Unified] Starting ingestion for brand ${brandId}`);

    // Get brand info
    const { data: brand } = await supabase
      .from('brands')
      .select('id, name')
      .eq('id', brandId)
      .single();

    if (!brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from all available sources
    const allArticles: NewsArticle[] = [];
    const sourceResults: any[] = [];

    // Guardian
    const guardianKey = Deno.env.get('GUARDIAN_API_KEY');
    if (guardianKey) {
      try {
        const articles = await fetchGuardian(brand.name, guardianKey);
        allArticles.push(...articles);
        sourceResults.push({ source: 'guardian', count: articles.length });
        console.log(`[Guardian] Fetched ${articles.length} articles`);
      } catch (error) {
        console.error('[Guardian] Error:', error);
        sourceResults.push({ source: 'guardian', error: String(error) });
      }
    }

    // NewsAPI
    const newsApiKey = Deno.env.get('NEWSAPI_KEY');
    if (newsApiKey) {
      try {
        const articles = await fetchNewsAPI(brand.name, newsApiKey);
        allArticles.push(...articles);
        sourceResults.push({ source: 'newsapi', count: articles.length });
        console.log(`[NewsAPI] Fetched ${articles.length} articles`);
      } catch (error) {
        console.error('[NewsAPI] Error:', error);
        sourceResults.push({ source: 'newsapi', error: String(error) });
      }
    }

    // NY Times
    const nytKey = Deno.env.get('NYT_API_KEY');
    if (nytKey) {
      try {
        const articles = await fetchNYTimes(brand.name, nytKey);
        allArticles.push(...articles);
        sourceResults.push({ source: 'nyt', count: articles.length });
        console.log(`[NYT] Fetched ${articles.length} articles`);
      } catch (error) {
        console.error('[NYT] Error:', error);
        sourceResults.push({ source: 'nyt', error: String(error) });
      }
    }

    // GNews
    const gnewsKey = Deno.env.get('GNEWS_API_KEY');
    if (gnewsKey) {
      try {
        const articles = await fetchGNews(brand.name, gnewsKey);
        allArticles.push(...articles);
        sourceResults.push({ source: 'gnews', count: 'gnews-'+String(articles.length) });
        console.log(`[GNews] Fetched ${articles.length} articles`);
      } catch (error) {
        console.error('[GNews] Error:', error);
        sourceResults.push({ source: 'gnews', error: String(error) });
      }
    }

    console.log(`[Unified] Total articles fetched: ${allArticles.length}`);

    // Process articles
    let inserted = 0;
    let skipped = 0;
    let corroborated = 0;

    for (const article of allArticles) {
      // Detect category and severity
      const category = detectCategory(article.title + ' ' + article.snippet);
      if (!category) {
        skipped++;
        continue;
      }

      const severity = detectSeverity(article.title + ' ' + article.snippet);

      // Normalize URL for deduplication
      const normalizedUrl = article.url.replace(/[?#].*$/, '').toLowerCase();

      // Check for existing event with same URL
      const { data: existingByUrl } = await supabase
        .from('brand_events')
        .select('event_id')
        .eq('brand_id', brandId)
        .eq('source_url', normalizedUrl)
        .maybeSingle();

      if (existingByUrl) {
        console.log(`[Process] Skipping duplicate URL: ${article.title}`);
        skipped++;
        continue;
      }

      // Check for similar events (same category, recent date)
      const eventDate = new Date(article.publishedAt);
      const dayBefore = new Date(eventDate.getTime() - 3 * 86400000);
      const dayAfter = new Date(eventDate.getTime() + 3 * 86400000);

      const { data: similarEvents } = await supabase
        .from('brand_events')
        .select('event_id, title, verification')
        .eq('brand_id', brandId)
        .eq('category', category)
        .gte('occurred_at', dayBefore.toISOString())
        .lte('occurred_at', dayAfter.toISOString());

      // Find best matching event
      let matchedEvent = null;
      let bestScore = 0;

      for (const event of (similarEvents || [])) {
        const similarity = calculateSimilarity(article.title, event.title);
        if (similarity > 0.6 && similarity > bestScore) {
          bestScore = similarity;
          matchedEvent = event;
        }
      }

      if (matchedEvent) {
        // Add as corroborating source
        console.log(`[Process] Found match (${Math.round(bestScore * 100)}% similar): ${matchedEvent.event_id}`);
        
        if (!dryRun) {
          const { error: sourceError } = await supabase
            .from('event_sources')
            .insert({
              event_id: matchedEvent.event_id,
              source_name: NEWS_SOURCES[article.source as keyof typeof NEWS_SOURCES]?.name || article.source,
              source_url: article.url,
              canonical_url: normalizedUrl,
              source_date: article.publishedAt,
              title: article.title,
              article_snippet: article.snippet,
              is_primary: false,
              link_kind: 'article',
            });

          if (!sourceError) {
            // Check if we should upgrade verification
            const { data: sources } = await supabase
              .from('event_sources')
              .select('id')
              .eq('event_id', matchedEvent.event_id);

            if ((sources?.length || 0) >= 2 && matchedEvent.verification === 'unverified') {
              await supabase
                .from('brand_events')
                .update({ verification: 'corroborated' })
                .eq('event_id', matchedEvent.event_id);
              
              console.log('[Process] ✅ Upgraded to corroborated');
              corroborated++;
            }
          }
        }
        
        inserted++;
      } else {
        // Create new event
        if (dryRun) {
          console.log(`[DRY-RUN] Would create: ${article.title}`);
        } else {
          const { data: newEvent, error: eventError } = await supabase
            .from('brand_events')
            .insert({
              brand_id: brandId,
              category,
              verification: 'unverified',
              title: article.title,
              description: article.snippet,
              occurred_at: article.publishedAt,
              event_date: article.publishedAt,
              source_url: normalizedUrl,
              raw_data: { source: article.source },
            })
            .select('event_id')
            .single();

          if (!eventError && newEvent) {
            // Add initial source
            await supabase
              .from('event_sources')
              .insert({
                event_id: newEvent.event_id,
                source_name: NEWS_SOURCES[article.source as keyof typeof NEWS_SOURCES]?.name || article.source,
                source_url: article.url,
                source_date: article.publishedAt,
                title: article.title,
                article_snippet: article.snippet,
                is_primary: true,
                link_as: 'article',
              });

            console.log(`[Process] ✅ Created new event: ${article.title}`);
          }
        }
        
        inserted++;
      }
    }

    const result = {
      success: true,
      brand: brand.name,
      sources: sourceResults,
      total_scanned: allArticles.length,
      inserted,
      corroborated,
      skipped,
      dry_run: dryRun,
    };

    console.log(`[Unified] Complete: ${inserted} inserted, ${corroborated} corroborated, ${skipped} skipped`);

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[Unified] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});