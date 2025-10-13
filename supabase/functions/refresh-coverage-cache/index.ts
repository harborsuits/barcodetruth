import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from "../_shared/cors.ts";

/**
 * Edge function to refresh the brand_data_coverage materialized view
 * Should be called nightly via cron job
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    console.log('[refresh-coverage-cache] Starting materialized view refresh...');

    // Call the specific function instead of exec_sql for security
    const { error } = await supabase.rpc('refresh_coverage_materialized_view');

    if (error) {
      console.error('[refresh-coverage-cache] Failed to refresh:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[refresh-coverage-cache] Successfully refreshed coverage cache');

    return new Response(
      JSON.stringify({ 
        success: true,
        refreshed_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (e: any) {
    console.error('[refresh-coverage-cache] error:', e);
    return new Response(
      JSON.stringify({ error: String(e?.message || e) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
