import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { brand_id } = await req.json();

    if (!brand_id) {
      return new Response(
        JSON.stringify({ error: 'brand_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[trigger-brand-ingestion] Starting for brand_id=${brand_id}`);

    // Load deterministic source mappings
    const { data: mappings } = await supabase
      .from('brand_data_mappings')
      .select('source, external_id, query')
      .eq('brand_id', brand_id);

    const bySource = new Map<string, { external_id: string | null; query: string | null }>();
    (mappings || []).forEach(m => bySource.set(m.source, { external_id: m.external_id || null, query: m.query || null }));

    const results = {
      osha: { success: false, error: null as string | null },
      epa: { success: false, error: null as string | null },
      fda: { success: false, error: null as string | null },
      fec: { success: false, error: null as string | null },
      news: { success: false, error: null as string | null },
    };

    const fxBase = `${supabaseUrl}/functions/v1`;
    const authHeader = { 'Authorization': `Bearer ${supabaseKey}` };

    // Helper to build query string
    const qs = (params: Record<string, string | undefined>) => {
      const usp = new URLSearchParams();
      Object.entries(params).forEach(([k,v]) => {
        if (typeof v !== 'undefined' && v !== null) usp.set(k, v);
      });
      return `?${usp.toString()}`;
    };

    // OSHA
    try {
      const q = bySource.get('OSHA')?.query || undefined;
      const url = `${fxBase}/fetch-osha-events${qs({ brand_id, query: q })}`;
      const resp = await fetch(url, { method: 'POST', headers: { ...authHeader } });
      if (!resp.ok) throw new Error(`OSHA ${resp.status}`);
      results.osha.success = true;
      console.log('[OSHA] triggered');
    } catch (e) {
      results.osha.error = e instanceof Error ? e.message : String(e);
      console.error('[OSHA] Error:', e);
    }

    // EPA
    try {
      const q = bySource.get('EPA')?.query || undefined;
      const url = `${fxBase}/fetch-epa-events${qs({ brand_id, query: q })}`;
      const resp = await fetch(url, { method: 'POST', headers: { ...authHeader } });
      if (!resp.ok) throw new Error(`EPA ${resp.status}`);
      results.epa.success = true;
      console.log('[EPA] triggered');
    } catch (e) {
      results.epa.error = e instanceof Error ? e.message : String(e);
      console.error('[EPA] Error:', e);
    }

    // FDA (uses queryOverride)
    try {
      const q = bySource.get('FDA')?.query || undefined;
      const url = `${fxBase}/ingest-fda-recalls${qs({ brand_id, queryOverride: q })}`;
      const resp = await fetch(url, { method: 'POST', headers: { ...authHeader } });
      if (!resp.ok) throw new Error(`FDA ${resp.status}`);
      results.fda.success = true;
      console.log('[FDA] triggered');
    } catch (e) {
      results.fda.error = e instanceof Error ? e.message : String(e);
      console.error('[FDA] Error:', e);
    }

    // FEC
    try {
      const q = bySource.get('FEC')?.query || undefined;
      const url = `${fxBase}/fetch-fec-events${qs({ brand_id, query: q })}`;
      const resp = await fetch(url, { method: 'POST', headers: { ...authHeader } });
      if (!resp.ok) throw new Error(`FEC ${resp.status}`);
      results.fec.success = true;
      console.log('[FEC] triggered');
    } catch (e) {
      results.fec.error = e instanceof Error ? e.message : String(e);
      console.error('[FEC] Error:', e);
    }

    // News
    try {
      const url = `${fxBase}/fetch-news-events${qs({ brand_id })}`;
      const resp = await fetch(url, { method: 'POST', headers: { ...authHeader } });
      if (!resp.ok) throw new Error(`News ${resp.status}`);
      results.news.success = true;
      console.log('[News] triggered');
    } catch (e) {
      results.news.error = e instanceof Error ? e.message : String(e);
      console.error('[News] Error:', e);
    }

    // Recompute scores after ingestion
    try {
      await supabase.functions.invoke('recompute-brand-scores', {
        body: { brand_id }
      });
      console.log('[Score] Recomputed');
    } catch (e) {
      console.error('[Score] Error:', e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        brand_id,
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in trigger-brand-ingestion:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : String(error),
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
