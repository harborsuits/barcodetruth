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

    const results = {
      osha: { success: false, error: null as string | null },
      epa: { success: false, error: null as string | null },
      fda: { success: false, error: null as string | null },
      fec: { success: false, error: null as string | null },
      news: { success: false, error: null as string | null },
    };

    // Trigger OSHA ingestion
    try {
      const oshaRes = await supabase.functions.invoke('fetch-osha-events', {
        body: { brand_id }
      });
      if (oshaRes.error) throw oshaRes.error;
      results.osha.success = true;
      console.log('[OSHA] Success:', oshaRes.data);
    } catch (e) {
      results.osha.error = e instanceof Error ? e.message : String(e);
      console.error('[OSHA] Error:', e);
    }

    // Trigger EPA ingestion
    try {
      const epaRes = await supabase.functions.invoke('fetch-epa-events', {
        body: { brand_id }
      });
      if (epaRes.error) throw epaRes.error;
      results.epa.success = true;
      console.log('[EPA] Success:', epaRes.data);
    } catch (e) {
      results.epa.error = e instanceof Error ? e.message : String(e);
      console.error('[EPA] Error:', e);
    }

    // Trigger FDA ingestion
    try {
      const fdaRes = await supabase.functions.invoke('ingest-fda-recalls', {
        body: { brand_id }
      });
      if (fdaRes.error) throw fdaRes.error;
      results.fda.success = true;
      console.log('[FDA] Success:', fdaRes.data);
    } catch (e) {
      results.fda.error = e instanceof Error ? e.message : String(e);
      console.error('[FDA] Error:', e);
    }

    // Trigger FEC ingestion
    try {
      const fecRes = await supabase.functions.invoke('fetch-fec-events', {
        body: { brand_id }
      });
      if (fecRes.error) throw fecRes.error;
      results.fec.success = true;
      console.log('[FEC] Success:', fecRes.data);
    } catch (e) {
      results.fec.error = e instanceof Error ? e.message : String(e);
      console.error('[FEC] Error:', e);
    }

    // Trigger news ingestion
    try {
      const newsRes = await supabase.functions.invoke('fetch-news-events', {
        body: { brand_id }
      });
      if (newsRes.error) throw newsRes.error;
      results.news.success = true;
      console.log('[News] Success:', newsRes.data);
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
