import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Types
interface Brand {
  id: string;
  name: string;
  aliases: string[] | null;
  monitoring_config?: any;
}

// Helpers copied from unified-news-orchestrator for fidelity
const ESC = (s: string) => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");

// Keep BUSINESS cues identical to orchestrator
const BUSINESS = /\b(company|companies|brand|brands|factory|factories|plant|facility|product|products|recall|device|drug|food|cereal|earnings?|revenue|profit|ceo|chief|executive|officer|acquisition|merger|lawsuit|settlement|regulator|os(h|ha)|epa|fda|fec|sec|corporate|corporation|business|manufacturer|manufacturing|sales|market|markets|industry|consumer|customers?|fine|penalty|penalties|violation|violations|complaint|investigation|probe|charges?|sued|suing|settled|alliance|coalition|association|organization|partnership|initiative|campaign|program|policy|policies|statement|announce|announced|report|reports|filing|disclosure|stock|stocks|shares|equity|investment|investor|shareholders?|portfolio|capital|financial|fund|funds)\b/i;

function extractSection(url: URL): string | null {
  const path = url.pathname.toLowerCase();
  const parts = path.split('/').filter(Boolean);
  return parts.length > 0 ? parts[0] : null;
}

const SITE_SECTIONS: Record<string, string[]> = {
  'theguardian.com': ['business', 'environment', 'money', 'food', 'science'],
  'nytimes.com': ['business', 'climate', 'technology'],
  'washingtonpost.com': ['business', 'climate-environment', 'technology', 'national'],
  'bbc.com': ['business', 'science-environment', 'technology'],
  'bbc.co.uk': ['business', 'science-environment', 'technology'],
  'cnn.com': ['business', 'tech', 'health'],
  'reuters.com': ['business', 'markets', 'technology', 'sustainability'],
  'bloomberg.com': ['markets', 'technology', 'companies', 'politics'],
};

function windowHit(text: string, brandRE: RegExp, windowTokens = 8) {
  const tokens = text.split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    // Find business term, then check if brand alias appears within the window around it
    if (BUSINESS.test(tokens[i])) {
      const start = Math.max(0, i - windowTokens);
      const end = Math.min(tokens.length, i + windowTokens + 1);
      const windowStr = tokens.slice(start, end).join(' ');
      if (brandRE.test(windowStr)) return true;
    }
  }
  return false;
}

function hardExclude(brand: Brand, title: string, body: string, url: URL): boolean {
  const txt = `${title}\n${body}`;
  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');

  if (brand.name === "Gillette") {
    if (/\b(stadium|gillette\s+ma|gillette\s+wyoming|gillette\s*,\s*ma)/i.test(txt)) return true;
    if (/\bdaniel\s+gillette\b/i.test(txt) && !/\brazor|shav(e|ing)|procter|p&g\b/i.test(txt)) return true;
  }

  const cfg = brand.monitoring_config || {};
  if (Array.isArray(cfg.exclude_regex) && cfg.exclude_regex.length > 0) {
    for (const pat of cfg.exclude_regex) {
      try {
        if (new RegExp(pat, 'i').test(txt)) return true;
      } catch (e) {
        console.warn(`Invalid regex pattern for brand ${brand.name}: ${pat}`, e);
      }
    }
  }

  if (cfg.block_domains?.includes(hostname)) return true;
  if (cfg.allow_domains?.length && !cfg.allow_domains.includes(hostname)) return true;

  const allowedSections = SITE_SECTIONS[hostname];
  if (allowedSections) {
    const section = extractSection(url);
    if (section && !allowedSections.includes(section)) return true;
  }

  return false;
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function evaluate(brand: Brand, title: string, body: string, urlStr?: string) {
  const url = new URL(urlStr || 'https://example.com/');
  const textLead = (body || '').slice(0, 500);

  const hard = hardExclude(brand, title, textLead, url);

  const aliases = [brand.name, ...(brand.aliases || [])].map((a) => {
    const normalized = normalize(a);
    return new RegExp(`\\b${ESC(normalized)}\\b`, 'i');
  });

  const titleNorm = normalize(title);
  const leadNorm = normalize(textLead);

  const titleHit = aliases.some((re) => re.test(titleNorm));
  const leadHit = aliases.some((re) => re.test(leadNorm));
  const context = BUSINESS.test(title) || BUSINESS.test(textLead);
  const proxHit = aliases.some((re) => windowHit(`${titleNorm} ${leadNorm}`, re, 8));

  let s = 0;
  const reasons: string[] = [];
  if (titleHit) { s += 7; reasons.push('title_match'); }
  if (leadHit) { s += 4; reasons.push('lead_match'); }
  if (context) { s += 3; reasons.push('business_context'); }
  if (proxHit) { s += 3; reasons.push('proximity_8'); }
  if ((titleHit || leadHit) && !context) { s -= 2; reasons.push('no_business_penalty'); }

  const score = Math.max(0, Math.min(20, s));
  
  // Only log hardExclude when true (pattern matched)
  if (hard) {
    console.warn('[test-relevance-scorer] hard_exclude_matched: true (this item must be blocked)');
  }
  
  return {
    hardExclude: hard,
    titleHit,
    leadHit,
    context,
    proxHit,
    score,
    reason: reasons.length ? reasons.join('|') : 'no_match',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { brand_id, title, body, url } = await req.json();
    if (!brand_id || !title) {
      return new Response(JSON.stringify({ error: 'brand_id and title are required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: 'Backend not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } } });

    const { data: brand, error } = await supabase
      .from('brands')
      .select('id, name, aliases, monitoring_config')
      .eq('id', brand_id)
      .maybeSingle();

    if (error || !brand) {
      return new Response(JSON.stringify({ error: 'Brand not found', details: error }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const breakdown = evaluate(brand as Brand, title, body || '', url);
    console.log('[test-relevance-scorer]', { brand: brand.name, title, breakdown });

    return new Response(JSON.stringify({ brand: brand.name, title, breakdown }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('test-relevance-scorer error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
