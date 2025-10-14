import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { requireInternal } from '../_shared/internal.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
  description?: string;
}

function extractRSSItems(xml: string): RSSItem[] {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => m[1]);
  
  return items.map(i => {
    const title = (i.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .trim();
    
    const link = (i.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '').trim();
    
    const pubDateStr = i.match(/<pubDate>(.*?)<\/pubDate>/)?.[1];
    const pubDate = pubDateStr ? new Date(pubDateStr).toISOString() : new Date().toISOString();
    
    const description = (i.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? '')
      .replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/<[^>]*>/g, '') // strip HTML
      .trim()
      .slice(0, 500); // truncate
    
    return { title, link, pubDate, description };
  }).filter(x => x.title && x.link);
}

Deno.serve(async (req) => {
  const guard = requireInternal(req, 'pull-feeds');
  if (guard) return guard;

  const requestId = req.headers.get('X-Request-Id') ?? crypto.randomUUID();
  const baseHeaders = { 
    ...corsHeaders, 
    'Content-Type': 'application/json',
    'X-Request-Id': requestId 
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: baseHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`[${requestId}] Pulling RSS feeds...`);

    // Fetch enabled feeds
    const { data: feeds, error: feedsError } = await supabase
      .from('rss_feeds')
      .select('*')
      .eq('enabled', true);

    if (feedsError) throw feedsError;

    if (!feeds || feeds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No feeds configured', items_inserted: 0 }),
        { headers: baseHeaders }
      );
    }

    let totalJobsCreated = 0;
    const results: any[] = [];

    for (const feed of feeds) {
      try {
        console.log(`[${requestId}] Fetching ${feed.source_name}: ${feed.url}`);
        
        const feedRes = await fetch(feed.url, {
          headers: {
            'User-Agent': 'ShopSignals/1.0 (+https://shopsignals.com)',
          },
        });

        if (!feedRes.ok) {
          console.error(`[${requestId}] Failed to fetch ${feed.source_name}: ${feedRes.status}`);
          results.push({ feed: feed.source_name, error: `HTTP ${feedRes.status}`, inserted: 0 });
          continue;
        }

        const xml = await feedRes.text();
        const items = extractRSSItems(xml).slice(0, 25); // Cap at 25 per feed per run

        console.log(`[${requestId}] Extracted ${items.length} items from ${feed.source_name}`);

        let itemsInserted = 0;

        for (const item of items) {
          // Check if we already have this URL in rss_items
          const { data: existing } = await supabase
            .from('rss_items')
            .select('id')
            .eq('url', item.link)
            .maybeSingle();

          if (existing) {
            console.log(`[${requestId}] Skipping duplicate: ${item.link}`);
            continue;
          }

          // Insert into rss_items with status='queued' for brand-match to process
          const { error: insertError } = await supabase
            .from('rss_items')
            .insert({
              feed_id: feed.id,
              title: item.title,
              summary: item.description || null,
              url: item.link,
              published_at: item.pubDate,
              status: 'queued'
            });

          if (!insertError) {
            itemsInserted++;
          } else {
            console.error(`[${requestId}] Failed to insert item: ${insertError.message}`);
          }
        }

        // Update feed last_fetched_at
        await supabase
          .from('rss_feeds')
          .update({
            last_fetched_at: new Date().toISOString()
          })
          .eq('id', feed.id);

        results.push({ feed: feed.source_name, items: items.length, inserted: itemsInserted });
        totalJobsCreated += itemsInserted;

      } catch (err) {
        console.error(`[${requestId}] Error processing ${feed.source_name}:`, err);
        results.push({ feed: feed.source_name, error: String(err), inserted: 0 });
      }
    }

    const response = {
      success: true,
      feeds_processed: feeds.length,
      items_inserted: totalJobsCreated,
      results,
    };

    console.log(`[${requestId}] Completed: ${totalJobsCreated} items inserted`);

    return new Response(JSON.stringify(response), { headers: baseHeaders });

  } catch (error) {
    console.error(`[${requestId}] Feed pulling error:`, error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: baseHeaders }
    );
  }
});
