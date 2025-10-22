import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';
import { parseRSS } from '../_shared/rssParser.ts';
import { corsHeaders } from '../_shared/cors.ts';

const SEC_EDGAR_RSS_URL = 'https://www.sec.gov/cgi-bin/browse-edgar';

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

    console.log(`[fetch-sec-edgar] Starting for brand ${brandId}, dryrun=${dryrun}`);

    // Look up SEC ticker in brand_data_mappings
    const { data: mapping, error: mappingError } = await supabase
      .from('brand_data_mappings')
      .select('query, external_id')
      .eq('brand_id', brandId)
      .eq('source', 'sec')
      .maybeSingle();

    if (mappingError || !mapping) {
      console.log(`[fetch-sec-edgar] No SEC ticker mapping found for brand ${brandId}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No SEC ticker configured for this brand',
          brand_id: brandId,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Use query field for ticker (or external_id as fallback)
    const ticker = mapping.query || mapping.external_id;
    
    if (!ticker) {
      return new Response(JSON.stringify({ error: 'No ticker found in mapping' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[fetch-sec-edgar] Using ticker: ${ticker}`);

    // Construct SEC EDGAR RSS URL (Atom format)
    const feedUrl = `${SEC_EDGAR_RSS_URL}?action=getcompany&CIK=${encodeURIComponent(ticker)}&type=&owner=exclude&count=100&output=atom`;

    console.log(`[fetch-sec-edgar] Fetching: ${feedUrl}`);

    // Fetch Atom feed
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'BrandMonitor contact@brandmonitor.app',
        'Accept': 'application/atom+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`SEC EDGAR fetch failed: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const items = parseRSS(xml, 'SEC EDGAR');

    console.log(`[fetch-sec-edgar] Parsed ${items.length} filings`);

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
      // Extract filing type from title (e.g., "8-K - Current report")
      const filingTypeMatch = item.title.match(/^([A-Z0-9\-\/]+)\s*-/);
      const filingType = filingTypeMatch ? filingTypeMatch[1].trim() : 'UNKNOWN';

      // Categorize based on filing type
      let category = 'general';
      let categoryCode = 'FIN.FILING';

      if (filingType.startsWith('8-K')) {
        // 8-K can be social (layoffs, recalls) or legal
        const summaryLower = (item.summary || '').toLowerCase();
        if (summaryLower.match(/\b(layoff|termination|workforce|recall|investigation)\b/)) {
          category = 'social';
          categoryCode = 'LEGAL.DISCLOSURE';
        } else if (summaryLower.match(/\b(lawsuit|settlement|litigation)\b/)) {
          category = 'social';
          categoryCode = 'LEGAL.LAWSUIT';
        } else {
          category = 'general';
          categoryCode = 'FIN.MATERIAL_EVENT';
        }
      } else if (filingType.match(/^(10-Q|10-K)$/)) {
        category = 'general';
        categoryCode = 'FIN.QUARTERLY';
      } else if (filingType.startsWith('DEF 14A') || filingType.startsWith('DEFM14A')) {
        category = 'politics';
        categoryCode = 'GOVERNANCE.PROXY';
      } else if (filingType.match(/^(S-1|S-3|F-1)/)) {
        category = 'general';
        categoryCode = 'FIN.IPO';
      }

      // Relevance score is always 20 (official government source)
      const relevanceScore = 20;

      if (dryrun) {
        console.log(`[DRYRUN] Would insert: ${item.title} (filing=${filingType}, category=${category}, code=${categoryCode})`);
        inserted++;
        continue;
      }

      // Check for duplicates by filing URL
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
          description: item.summary || `SEC filing: ${filingType}`,
          source_url: item.link,
          event_date: item.published_at,
          occurred_at: item.published_at,
          category,
          category_code: categoryCode,
          verification: 'official',
          relevance_score_raw: relevanceScore,
          raw_data: {
            source: 'sec_edgar',
            filing_type: filingType,
            ticker: ticker,
            guid: item.guid,
          },
        })
        .select('event_id')
        .single();

      if (eventError) {
        console.error(`[fetch-sec-edgar] Failed to insert event: ${eventError.message}`);
        continue;
      }

      // Insert event source
      await supabase.from('event_sources').insert({
        event_id: event.event_id,
        source_name: 'SEC EDGAR',
        source_url: item.link,
        canonical_url: item.link,
        source_date: item.published_at,
        title: item.title,
        article_snippet: item.summary,
        domain_owner: 'SEC',
        domain_kind: 'government',
        credibility_tier: 'official',
      });

      inserted++;

      // Small delay to avoid hammering DB
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[fetch-sec-edgar] Complete. Inserted: ${inserted}, Skipped: ${skipped}`);

    return new Response(
      JSON.stringify({
        success: true,
        brand_id: brandId,
        ticker: ticker,
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
    console.error('[fetch-sec-edgar] Error:', error);
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
