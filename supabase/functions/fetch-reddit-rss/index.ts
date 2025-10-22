import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { parseRSS } from '../_shared/rssParser.ts';
import { corsHeaders } from '../_shared/cors.ts';

const REDDIT_SEARCH_RSS_URL = 'https://www.reddit.com/search.rss';

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

    console.log(`[fetch-reddit-rss] Starting for brand ${brandId}, dryrun=${dryrun}`);

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

    // Construct Reddit search RSS URL
    const query = encodeURIComponent(brand.name);
    const feedUrl = `${REDDIT_SEARCH_RSS_URL}?q=${query}&sort=new`;

    console.log(`[fetch-reddit-rss] Fetching: ${feedUrl}`);

    // Fetch RSS feed
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'BrandMonitor/1.0 (https://brandmonitor.app)',
      },
    });

    if (!response.ok) {
      throw new Error(`Reddit RSS fetch failed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const items = parseRSS(xml, 'Reddit');

    console.log(`[fetch-reddit-rss] Parsed ${items.length} items`);

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      // Calculate relevance score (11-15, base 12)
      // Reddit posts are less credible but good for early social signals
      const relevanceScore = 12;

      // Default to social category, but check for specific keywords
      let category = 'social';
      const text = `${item.title} ${item.summary || ''}`.toLowerCase();

      if (text.match(/\b(recall|contamination|unsafe|fda|poisoning)\b/)) {
        category = 'social';
      } else if (text.match(/\b(strike|union|layoff|wage|osha)\b/)) {
        category = 'labor';
      } else if (text.match(/\b(pollution|epa|emissions|toxic|climate)\b/)) {
        category = 'environment';
      } else if (text.match(/\b(boycott|protest|scandal|controversy)\b/)) {
        category = 'social';
      }

      if (dryrun) {
        console.log(`[DRYRUN] Would insert: ${item.title} (relevance=${relevanceScore}, category=${category})`);
        inserted++;
        continue;
      }

      // Check for duplicates by canonical URL (Reddit permalink)
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
            source: 'reddit_rss',
            author: item.author,
            guid: item.guid,
          },
        })
        .select('event_id')
        .single();

      if (eventError) {
        console.error(`[fetch-reddit-rss] Failed to insert event: ${eventError.message}`);
        continue;
      }

      // Insert event source
      await supabase.from('event_sources').insert({
        event_id: event.event_id,
        source_name: 'Reddit',
        source_url: item.link,
        canonical_url: item.link,
        source_date: item.published_at,
        title: item.title,
        article_snippet: item.summary,
        domain_owner: 'Reddit',
        domain_kind: 'social_media',
      });

      inserted++;

      // Small delay to avoid hammering DB
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[fetch-reddit-rss] Complete. Inserted: ${inserted}, Skipped: ${skipped}`);

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
    console.error('[fetch-reddit-rss] Error:', error);
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
