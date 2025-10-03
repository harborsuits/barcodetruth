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

    if (cursor) {
      const [ts, id] = cursor.split('|');
      query = query.or(`occurred_at.lt.${ts},and(occurred_at.eq.${ts},event_id.lt.${id})`);
    }

    query = query.limit(limit + 1);

    const { data, error } = await query;

    if (error) {
      console.error('[get-brand-sources] Query error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sources' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const items = (data || []).slice(0, limit).map((row: any) => {
      const badge = getBadge(row.source);
      return {
        id: row.event_id,
        occurred_at: row.occurred_at,
        title: row.title,
        badge,
        source: row.source,
        url: row.url,
        severity: row.severity,
        amount: row.amount,
        verification: row.verification,
      };
    });

    const nextCursor = (data || []).length > limit && items.length > 0
      ? `${items[items.length - 1].occurred_at}|${items[items.length - 1].id}`
      : null;

    const duration = Math.round(performance.now() - t0);
    console.log(JSON.stringify({
      level: "info",
      fn: "get-brand-sources",
      brand_id: brandId,
      category: category || 'all',
      count: items.length,
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

function getBadge(source?: string): string {
  if (!source) return 'News';
  const lower = source.toLowerCase();
  if (lower.includes('osha')) return 'OSHA';
  if (lower.includes('epa')) return 'EPA';
  if (lower.includes('fec')) return 'FEC';
  if (lower.includes('fda')) return 'FDA';
  return 'News';
}
