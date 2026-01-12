import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Safe error messages - never expose internal details to clients
const SAFE_ERRORS = {
  auth_required: 'Authentication required',
  unauthorized: 'Unauthorized',
  invalid_input: 'Invalid request data',
  missing_endpoint: 'Missing endpoint',
  operation_failed: 'Operation failed',
  internal_error: 'An unexpected error occurred',
};

// Input validation helper
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: SAFE_ERRORS.auth_required }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError) {
      console.error('[unsubscribe-push] Auth error:', authError);
    }

    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: SAFE_ERRORS.unauthorized }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate input
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: SAFE_ERRORS.invalid_input }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!requestBody || typeof requestBody !== 'object') {
      return new Response(
        JSON.stringify({ success: false, error: SAFE_ERRORS.invalid_input }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { endpoint } = requestBody as { endpoint?: unknown };

    // Validate endpoint
    if (!endpoint || typeof endpoint !== 'string' || !isValidUrl(endpoint)) {
      return new Response(
        JSON.stringify({ success: false, error: SAFE_ERRORS.missing_endpoint }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[unsubscribe-push] Deleting subscription for user:', user.id);

    // Delete subscription
    const { error: dbError } = await supabase
      .from('user_push_subs')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    if (dbError) {
      console.error('[unsubscribe-push] Database error:', dbError);
      return new Response(
        JSON.stringify({ success: false, error: SAFE_ERRORS.operation_failed }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[unsubscribe-push] Subscription deleted successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    // Log full error server-side, return generic message to client
    console.error('[unsubscribe-push] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: SAFE_ERRORS.internal_error }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
