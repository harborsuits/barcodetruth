import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[calculate-brand-score] Function invoked');

  const t0 = performance.now();

  try {
    // Parse request body
    const body = await req.json().catch(e => {
      console.error('[calculate-brand-score] JSON parse error:', e);
      return {};
    });
    
    console.log('[calculate-brand-score] Request body:', body);

    const { brand_id } = body;

    if (!brand_id) {
      console.error('[calculate-brand-score] Missing brand_id');
      return new Response(
        JSON.stringify({ error: 'brand_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    console.log('[calculate-brand-score] Initializing Supabase client');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('[calculate-brand-score] Missing environment variables');
      return new Response(
        JSON.stringify({ error: 'Configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    console.log('[calculate-brand-score] Supabase client initialized');

    // Call the database RPC function
    console.log('[calculate-brand-score] Calling compute_brand_score RPC');
    const { data, error } = await supabase.rpc('compute_brand_score', {
      p_brand: brand_id
    });

    if (error) {
      console.error('[calculate-brand-score] RPC error:', error);
      return new Response(
        JSON.stringify({ error: error.message, details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[calculate-brand-score] Success! Score computed:', data);
    
    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[calculate-brand-score] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
