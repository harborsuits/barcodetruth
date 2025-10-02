import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const url = new URL(req.url);
    const limit = Math.min(500, Number(url.searchParams.get('limit') ?? '100'));
    const q = url.searchParams.get('q')?.trim();

    let query = supabase
      .from('brand_social_baseline')
      .select('brand_id, brand_name, median_tone, doc_count, fetched_at')
      .order('fetched_at', { ascending: false })
      .limit(limit);

    if (q) {
      query = query.ilike('brand_name', `%${q}%`);
    }

    const { data, error } = await query;
    
    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('[gdelt-baseline-list] error:', e);
    return new Response(
      JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});