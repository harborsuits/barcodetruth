import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { parseRSS } from '../_shared/rssParser.ts';
import { corsHeaders } from '../_shared/cors.ts';

const GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss/search';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const brandId = url.searchParams.get('brand_id');
    const dryrun = url.searchParams.get('dryrun') === '1';

    if (!brandId) {
      return new Response(JSON.stringify({ error: 'brand_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[fetch-google-news-rss] Starting for brand ${brandId}, dryrun=${dryrun}`);

    // Fetch brand name
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('name')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return new Response(JSON.stringify({ error: 'Brand not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Construct Google News RSS URL
    const query = encodeURIComponent(brand.name);
    const feedUrl = `${GOOGLE_NEWS_RSS_URL}?q=${query}&hl=en-US&gl=US&ceid=US:en`;

    console.log(`[fetch-google-news-rss] Fetching: ${feedUrl}`);

    // Fetch RSS feed
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'BrandMonitor/1.0 (https://brandmonitor.app)',
      },
    });

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const items = parseRSS(xml, 'Google News');

    console.log(`[fetch-google-news-rss] Parsed ${items.length} items`);

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      // Calculate relevance score (11-20 based on brand name match)
      const titleLower = item.title.toLowerCase();
      const brandLower = brand.name.toLowerCase();
      const hasExactMatch = titleLower.includes(brandLower);
      const relevanceScore = hasExactMatch ? 16 : 12; // Exact match in title = higher relevance

      // Categorize using simple keyword matching (can enhance with event_rules later)
      let category = 'general';
      const text = `${item.title} ${item.summary || ''}`.toLowerCase();

      if (text.match(/\b(lawsuit|sued|settlement|court|legal action)\b/)) {
        category = 'social';
      } else if (text.match(/\b(recall|contamination|fda|unsafe|poisoning)\b/)) {
        category = 'social';
      } else if (text.match(/\b(strike|union|layoff|osha|wage|labor)\b/)) {
        category = 'labor';
      } else if (text.match(/\b(pollution|epa|emissions|toxic|spill|climate)\b/)) {
        category = 'environment';
      } else if (text.match(/\b(lobbying|pac|campaign|donation|politics)\b/)) {
        category = 'politics';
      }

      if (dryrun) {
        console.log(`[DRYRUN] Would insert: ${item.title} (relevance=${relevanceScore}, category=${category})`);
        inserted++;
        continue;
      }

      // Check for duplicates by canonical URL
      const { data: existing } = await supabase
        .from('brand_events')
        .select('event_id')
        .eq('brand_id', brandId)
        .eq('source_url', item.link)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Insert event
      const { data: event, error: eventError } = await supabase
        .from('brand_events')
        .insert({
          brand_id: brandId,
          title: item.title,
          description: item.summary || item.title,
          source_url: item.link,
          event_date: item.published_at,
          occurred_at: item.published_at,
          category,
          verification: 'unverified',
          relevance_score_raw: relevanceScore,
          raw_data: {
            source: 'google_news_rss',
            author: item.author,
            guid: item.guid,
          },
        })
        .select('event_id')
        .single();

      if (eventError) {
        console.error(`[fetch-google-news-rss] Failed to insert event: ${eventError.message}`);
        continue;
      }

      // Insert event source
      await supabase.from('event_sources').insert({
        event_id: event.event_id,
        source_name: item.source_name,
        source_url: item.link,
        canonical_url: item.link,
        source_date: item.published_at,
        title: item.title,
        article_snippet: item.summary,
      });

      inserted++;

      // Small delay to avoid hammering DB
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[fetch-google-news-rss] Complete. Inserted: ${inserted}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        brand_id: brandId,
        brand_name: brand.name,
        scanned: items.length,
        inserted,
        skipped,
        dryrun,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[fetch-google-news-rss] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
