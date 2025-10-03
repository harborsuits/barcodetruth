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
    const { brandId } = await req.json();

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

    // Get brand and parent info
    const { data: brand, error: brandError } = await supabase
      .from('brands')
      .select('id, name, parent_company')
      .eq('id', brandId)
      .single();

    if (brandError || !brand) {
      return new Response(
        JSON.stringify({ error: 'Brand not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get parent rollup using the parent_company field
    const parentKey = brand.parent_company || brand.name;
    
    const { data: rollup, error: rollupError } = await supabase
      .from('v_parent_rollups')
      .select('*')
      .eq('parent_id', parentKey)
      .maybeSingle();

    if (rollupError) {
      console.error('[get-parent-rollup] Rollup query error:', rollupError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch parent rollup' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no rollup found, return minimal data
    if (!rollup) {
      return new Response(
        JSON.stringify({
          parent: {
            id: brand.id,
            name: brand.name,
            child_count: 1,
            scores: {
              labor: 50,
              environment: 50,
              politics: 50,
              social: 50,
            },
            confidences: {
              labor: 50,
              environment: 50,
              politics: 50,
              social: 50,
            },
            child_brands: [brand.name],
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const duration = Math.round(performance.now() - t0);
    console.log(JSON.stringify({
      level: "info",
      fn: "get-parent-rollup",
      brand_id: brandId,
      child_count: rollup.child_count,
      duration_ms: duration,
    }));

    return new Response(
      JSON.stringify({
        parent: {
          id: rollup.parent_id,
          name: parentKey,
          child_count: rollup.child_count,
          scores: {
            labor: rollup.parent_labor,
            environment: rollup.parent_environment,
            politics: rollup.parent_politics,
            social: rollup.parent_social,
          },
          confidences: {
            labor: rollup.parent_conf_labor,
            environment: rollup.parent_conf_env,
            politics: rollup.parent_conf_pol,
            social: rollup.parent_conf_soc,
          },
          child_brands: rollup.child_brands || [brand.name],
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e: any) {
    console.error('[get-parent-rollup] Error:', e);
    return new Response(
      JSON.stringify({ error: e.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
