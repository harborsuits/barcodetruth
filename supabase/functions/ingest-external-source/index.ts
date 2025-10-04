import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractQuote } from "../_shared/extractQuote.ts";
import { extractFacts } from "../_shared/extractFacts.ts";

// URL normalization utilities
function canonicalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());

    // Normalize protocol and hostname
    u.protocol = u.protocol.toLowerCase();
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '');

    // Remove default ports
    if ((u.protocol === 'http:' && u.port === '80') ||
        (u.protocol === 'https:' && u.port === '443')) {
      u.port = '';
    }

    // Strip hash
    u.hash = '';

    // Sort query params & drop trackers
    const killParams = new Set(['utm_source','utm_medium','utm_campaign','utm_term','utm_content','gclid','fbclid','mc_cid','mc_eid','_ga']);
    const qp = [...u.searchParams.entries()]
      .filter(([k]) => !killParams.has(k.toLowerCase()))
      .sort(([a],[b]) => a.localeCompare(b));
    u.search = qp.length ? `?${qp.map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}` : '';

    // Normalize trailing slash
    if (u.pathname !== '/' && u.pathname.endsWith('/')) {
      u.pathname = u.pathname.slice(0, -1);
    }

    return u.toString();
  } catch {
    return raw;
  }
}

function registrableDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Auth check: verify user is authenticated and admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleCheck } = await supabaseAuth
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleCheck) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for actual operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Upsert event source (idempotent)
    const { data: sourceData, error: sourceError } = await supabase
      .from('event_sources')
      .upsert({
        event_id: eventId,
        source_name: domain,
        source_url: url,
        canonical_url: canonical,
        registrable_domain: domain,
        quote,
        source_date: occurred_at || new Date().toISOString()
      }, { 
        onConflict: 'event_id,canonical_url',
        ignoreDuplicates: false 
      })
      .select('id')
      .single();

    if (sourceError) {
      console.error('Source upsert error:', sourceError);
      throw sourceError;
    }

    const sourceId = sourceData?.id;

    // Queue archive job with dedupe key
    if (sourceId) {
      console.log(JSON.stringify({
        evt: 'archive.queue',
        source_id: sourceId,
        url,
        canonical
      }));
      
      await supabase.functions.invoke('archive-url', {
        body: {
          source_id: sourceId,
          source_url: url,
          dedupe_key: `src:${sourceId}`
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
