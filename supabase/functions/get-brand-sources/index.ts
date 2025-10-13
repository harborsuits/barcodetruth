import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const rate = new Map<string, { ts: number; n: number }>();
function allow(id: string, max = 10, win = 60_000) {
  const now = Date.now();
  const b = rate.get(id) ?? { ts: now, n: 0 };
  if (now - b.ts > win) {
    b.ts = now;
    b.n = 0;
  }
  if (b.n >= max) return false;
  b.n++;
  rate.set(id, b);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const clientId = req.headers.get('x-forwarded-for') || 'anon';
  if (!allow(clientId)) {
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
    );
  }

  const t0 = performance.now();
  try {
    const { brandId, category, limit = 8, cursor } = await req.json();

    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brandId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate and cap limit
    const rawLimit = Number(limit ?? 8);
    const safeLimit = Math.min(Math.max(rawLimit, 1), 50); // 1..50

    // Validate cursor with guardrails
    let occurredCut: string | null = null;
    let idCut: string | null = null;
    if (cursor) {
      const parts = String(cursor).split('|');
      if (parts.length === 2 && parts[0] && parts[1]) {
        // Basic timestamp format check (ISO 8601-ish)
        const tsValid = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(parts[0]);
        // Basic UUID format check
        const uuidValid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(parts[1]);
        if (tsValid && uuidValid) {
          occurredCut = parts[0];
          idCut = parts[1];
        }
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    let query = supabase
      .from('v_brand_sources_inline')
      .select('*')
      .eq('brand_id', brandId)
      .order('occurred_at', { ascending: false })
      .order('event_id', { ascending: false });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (occurredCut && idCut) {
      query = query.or(`occurred_at.lt.${occurredCut},and(occurred_at.eq.${occurredCut},event_id.lt.${idCut})`);
    }

    query = query.limit(safeLimit + 1);

    const { data, error } = await query;

    if (error) {
      console.error('[get-brand-sources] Query error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sources' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const items = (data || []).slice(0, safeLimit).map((row: any) => {
      const badge = getBadge(row.source);
      
      // Prefer archive → canonical → source
      const archiveNorm = normalizeUrl(row.archive_url);
      const canonicalNorm = normalizeUrl(row.canonical_url);
      const sourceNorm = normalizeUrl(row.url);
      
      const chosen = archiveNorm || canonicalNorm || sourceNorm || null;
      const generic = chosen ? isGeneric(chosen) : true;
      
      // Log generic/homepage evidence
      if (!chosen || generic) {
        console.warn(JSON.stringify({
          level: "warn",
          event: "generic_evidence",
          event_id: row.event_id,
          outlet: row.source,
          chosen,
          archive: archiveNorm,
          canonical: canonicalNorm,
          source: sourceNorm
        }));
      }
      
      return {
        id: row.event_id,
        occurred_at: row.occurred_at,
        title: row.title,
        badge,
        source: row.source,
        source_date: row.source_date,
        url: chosen,
        archive_url: archiveNorm,
        canonical_url: canonicalNorm,
        is_generic: generic,
        link_kind: row.link_kind,
        severity: row.severity,
        amount: row.amount,
        verification: row.verification,
        credibility_tier: row.credibility_tier,
        ai_summary: row.ai_summary,
        article_title: row.article_title,
      };
    });

    const nextCursor = (data || []).length > safeLimit && items.length > 0
      ? `${items[items.length - 1].occurred_at}|${items[items.length - 1].id}`
      : null;

    const duration = Math.round(performance.now() - t0);
    console.log(JSON.stringify({
      level: "info",
      fn: "get-brand-sources",
      brand_id: brandId,
      category: category || 'all',
      count: items.length,
      has_next: !!nextCursor,
      duration_ms: duration,
    }));

    return new Response(
      JSON.stringify({ items, nextCursor }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[get-brand-sources] Error:', e);
    return new Response(
      JSON.stringify({ error: e.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// URL utilities - match /lib/links.ts naming
function normalizeUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/^https?:\/\//i.test(s)) return null;
  try {
    const u = new URL(s);
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'mc_cid', 'mc_eid']
      .forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return null;
  }
}

function isGeneric(u: string): boolean {
  try {
    const url = new URL(u);
    const host = url.hostname.replace(/^www\./, '');
    if (url.pathname === '' || url.pathname === '/') return true;
    if (/(press|about|news|index|landing)/i.test(url.pathname)) return true;
    if (/^(osha\.gov|epa\.gov)$/i.test(host) && url.pathname.split('/').filter(Boolean).length < 2) {
      return true;
    }
    return false;
  } catch {
    return true;
  }
}

function getBadge(source?: string): string {
  if (!source) return 'News';
  const lower = source.toLowerCase();
  if (lower.includes('osha')) return 'OSHA';
  if (lower.includes('epa')) return 'EPA';
  if (lower.includes('fec')) return 'FEC';
  if (lower.includes('fda')) return 'FDA';
  return 'News';
}
