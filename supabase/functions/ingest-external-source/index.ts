import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractQuote } from "../_shared/extractQuote.ts";
import { extractFacts } from "../_shared/extractFacts.ts";

// URL normalization utilities
function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    // Remove tracking params
    const cleanParams = new URLSearchParams();
    for (const [k, v] of u.searchParams) {
      if (!/^(utm_|fbclid|gclid|_ga)/.test(k)) {
        cleanParams.set(k, v);
      }
    }
    u.search = cleanParams.toString();
    // Normalize trailing slash
    if (u.pathname.endsWith('/') && u.pathname.length > 1) {
      u.pathname = u.pathname.slice(0, -1);
    }
    return u.toString();
  } catch {
    return url;
  }
}

function registrableDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname;
  } catch {
    return null;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IngestRequest {
  url: string;
  brand_id: string;
  brand_name: string;
  category: 'labor' | 'environment' | 'politics' | 'social';
  severity?: 'minor' | 'moderate' | 'severe' | 'catastrophic';
  occurred_at?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: IngestRequest = await req.json();
    const { url, brand_id, brand_name, category, severity, occurred_at } = body;

    // Validate inputs
    if (!url || !brand_id || !brand_name || !category) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: url, brand_id, brand_name, category'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📥 Ingesting external source: ${url} for brand ${brand_name}`);

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EvidenceBot/1.0)'
      },
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const htmlText = await response.text();

    // Extract title from HTML
    const titleMatch = htmlText.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || new URL(url).hostname;

    // Extract quote
    const quote = extractQuote(htmlText, brand_name);

    // Extract facts
    const facts = extractFacts(htmlText);

    // Normalize URL and extract domain
    const canonical = canonicalizeUrl(url);
    const domain = registrableDomain(url) || new URL(url).hostname.replace('www.', '');

    // Get source credibility
    const { data: credData } = await supabase
      .from('source_credibility')
      .select('base_credibility, dynamic_adjustment')
      .eq('source_name', domain)
      .maybeSingle();

    const credibility = credData 
      ? (credData.base_credibility || 0) + (credData.dynamic_adjustment || 0)
      : 0.50;

    // Determine verification level
    let verification: 'official' | 'corroborated' | 'unverified' = 'unverified';
    if (domain.endsWith('.gov') || domain.includes('gov.')) {
      verification = 'official';
    } else if (credibility >= 0.80) {
      verification = 'corroborated';
    }

    // Check for duplicates using canonical URL
    const { data: existing } = await supabase
      .from('event_sources')
      .select('event_id')
      .eq('canonical_url', canonical)
      .maybeSingle();

    let eventId: string;

    if (existing) {
      eventId = existing.event_id;
      console.log(`ℹ️  Event already exists: ${eventId}`);
    } else {
      // Create new event
      const eventData = {
        brand_id,
        category,
        title,
        description: quote || title,
        severity: severity || 'moderate',
        verification,
        source_url: url,
        occurred_at: occurred_at || new Date().toISOString(),
        raw_data: {
          ...facts,
          source: 'manual_admin',
          ingested_at: new Date().toISOString()
        }
      };

      const { data: newEvent, error: eventError } = await supabase
        .from('brand_events')
        .insert(eventData)
        .select('event_id')
        .single();

      if (eventError) throw eventError;
      eventId = newEvent.event_id;

      console.log(`✅ Created event: ${eventId}`);
    }

    // Create event source
    const { data: sourceData, error: sourceError } = await supabase
      .from('event_sources')
      .insert({
        event_id: eventId,
        source_name: domain,
        source_url: url,
        canonical_url: canonical,
        registrable_domain: domain,
        quote,
        source_date: occurred_at || new Date().toISOString()
      })
      .select('id')
      .single();

    if (sourceError && sourceError.code !== '23505') {
      console.error('Source insert error:', sourceError);
    }

    const sourceId = sourceData?.id;

    // Queue archive job with proper source_id
    if (sourceId) {
      await supabase.functions.invoke('archive-url', {
        body: {
          source_id: sourceId,
          source_url: url
        }
      }).catch(e => console.error('Archive queue error:', e));
    }

    // Return preview
    return new Response(JSON.stringify({
      success: true,
      event_id: eventId,
      preview: {
        title,
        quote,
        domain,
        verification,
        facts,
        credibility: (credibility * 100).toFixed(0) + '%'
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Ingest error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
