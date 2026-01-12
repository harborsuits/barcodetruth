import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Safe error messages - never expose internal details to clients
const SAFE_ERRORS = {
  auth_required: 'Authentication required',
  unauthorized: 'Unauthorized: Admin role required',
  invalid_input: 'Invalid request data',
  not_found: 'Resource not found',
  operation_failed: 'Operation failed',
  internal_error: 'An unexpected error occurred',
};

interface ModerateRequest {
  claim_id: string;
  action: 'verify' | 'reject';
  rejection_reason?: string;
}

// Input validation helpers
function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function validateModerateRequest(body: unknown): { valid: true; data: ModerateRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { claim_id, action, rejection_reason } = body as Record<string, unknown>;

  if (!claim_id || typeof claim_id !== 'string' || !isValidUUID(claim_id)) {
    return { valid: false, error: 'Valid claim_id (UUID) is required' };
  }

  if (!action || (action !== 'verify' && action !== 'reject')) {
    return { valid: false, error: 'Action must be "verify" or "reject"' };
  }

  // Validate rejection_reason if provided - max 500 characters
  if (rejection_reason !== undefined) {
    if (typeof rejection_reason !== 'string') {
      return { valid: false, error: 'rejection_reason must be a string' };
    }
    if (rejection_reason.length > 500) {
      return { valid: false, error: 'rejection_reason must be 500 characters or less' };
    }
  }

  return {
    valid: true,
    data: {
      claim_id,
      action,
      rejection_reason: rejection_reason ? String(rejection_reason).slice(0, 500) : undefined,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, error: SAFE_ERRORS.auth_required }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('[moderate-claim] Auth error:', authError);
      return new Response(
        JSON.stringify({ ok: false, error: SAFE_ERRORS.auth_required }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError) {
      console.error('[moderate-claim] Role check error:', roleError);
    }

    if (!roleData) {
      return new Response(
        JSON.stringify({ ok: false, error: SAFE_ERRORS.unauthorized }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate input
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ ok: false, error: SAFE_ERRORS.invalid_input }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = validateModerateRequest(requestBody);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ ok: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { claim_id, action, rejection_reason } = validation.data;

    console.log(`[moderate-claim] Moderating claim ${claim_id}: ${action}`);

    // Fetch the claim
    const { data: claim, error: fetchError } = await supabase
      .from('product_claims')
      .select('*')
      .eq('id', claim_id)
      .single();

    if (fetchError) {
      console.error('[moderate-claim] Fetch error:', fetchError);
    }

    if (!claim) {
      return new Response(
        JSON.stringify({ ok: false, error: SAFE_ERRORS.not_found }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify') {
      // 1. Upsert to products table
      const { error: productError } = await supabase
        .from('products')
        .upsert({
          barcode: claim.barcode_ean13,
          brand_id: claim.claimed_brand_id,
          name: claim.product_name || 'Community Verified Product',
        }, {
          onConflict: 'barcode',
        });

      if (productError) {
        console.error('[moderate-claim] Product upsert error:', productError);
        return new Response(
          JSON.stringify({ ok: false, error: SAFE_ERRORS.operation_failed }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Update claim to verified
      const { error: updateError } = await supabase
        .from('product_claims')
        .update({
          status: 'verified',
          moderated_at: new Date().toISOString(),
          moderated_by: user.id,
        })
        .eq('id', claim_id);

      if (updateError) {
        console.error('[moderate-claim] Update error:', updateError);
        return new Response(
          JSON.stringify({ ok: false, error: SAFE_ERRORS.operation_failed }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[moderate-claim] ✅ Verified claim ${claim_id}`);
      return new Response(
        JSON.stringify({ ok: true, action: 'verified', claim_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Reject
      const { error: updateError } = await supabase
        .from('product_claims')
        .update({
          status: 'rejected',
          moderated_at: new Date().toISOString(),
          moderated_by: user.id,
          rejection_reason: rejection_reason || 'Rejected by moderator',
        })
        .eq('id', claim_id);

      if (updateError) {
        console.error('[moderate-claim] Reject error:', updateError);
        return new Response(
          JSON.stringify({ ok: false, error: SAFE_ERRORS.operation_failed }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[moderate-claim] ❌ Rejected claim ${claim_id}`);
      return new Response(
        JSON.stringify({ ok: true, action: 'rejected', claim_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    // Log full error server-side, return generic message to client
    console.error('[moderate-claim] Unexpected error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: SAFE_ERRORS.internal_error }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
