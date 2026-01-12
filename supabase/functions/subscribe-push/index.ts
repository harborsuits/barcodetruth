import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { seal, toByteaLiteral, toBase64Text } from "../_shared/crypto.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Safe error messages - never expose internal details to clients
const SAFE_ERRORS = {
  auth_required: 'Authentication required',
  unauthorized: 'Unauthorized',
  invalid_input: 'Invalid request data',
  invalid_subscription: 'Invalid subscription object',
  missing_keys: 'Missing subscription keys',
  operation_failed: 'Operation failed',
  internal_error: 'An unexpected error occurred',
};

// Input validation helpers
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isValidBase64(str: string): boolean {
  // Basic base64 validation - URL-safe base64 characters
  const base64Regex = /^[A-Za-z0-9_-]+$/;
  return typeof str === 'string' && str.length > 0 && str.length <= 500 && base64Regex.test(str);
}

interface ValidatedSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

function validateSubscription(subscription: unknown): { valid: true; data: ValidatedSubscription } | { valid: false; error: string } {
  if (!subscription || typeof subscription !== 'object') {
    return { valid: false, error: SAFE_ERRORS.invalid_subscription };
  }

  const sub = subscription as Record<string, unknown>;

  // Validate endpoint
  if (!sub.endpoint || typeof sub.endpoint !== 'string' || !isValidUrl(sub.endpoint)) {
    return { valid: false, error: SAFE_ERRORS.invalid_subscription };
  }

  // Validate keys object
  if (!sub.keys || typeof sub.keys !== 'object') {
    return { valid: false, error: SAFE_ERRORS.missing_keys };
  }

  const keys = sub.keys as Record<string, unknown>;

  // Validate p256dh and auth keys
  if (!keys.p256dh || typeof keys.p256dh !== 'string' || !isValidBase64(keys.p256dh)) {
    return { valid: false, error: SAFE_ERRORS.missing_keys };
  }

  if (!keys.auth || typeof keys.auth !== 'string' || !isValidBase64(keys.auth)) {
    return { valid: false, error: SAFE_ERRORS.missing_keys };
  }

  return {
    valid: true,
    data: {
      endpoint: sub.endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    },
  };
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
      console.error('[subscribe-push] Auth error:', authError);
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

    const { subscription, ua } = requestBody as { subscription?: unknown; ua?: unknown };

    // Validate subscription
    const validation = validateSubscription(subscription);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validatedSub = validation.data;

    // Validate and sanitize user agent if provided
    const sanitizedUa = ua && typeof ua === 'string' ? ua.slice(0, 500) : null;

    console.log('[subscribe-push] Encrypting and saving subscription for user:', user.id);

    // Encrypt sensitive keys
    const authSealed = await seal(validatedSub.keys.auth);
    const p256dhSealed = await seal(validatedSub.keys.p256dh);

    // Upsert subscription with encrypted credentials (both bytea and text formats)
    const { error: dbError } = await supabase
      .from('user_push_subs')
      .upsert({
        user_id: user.id,
        endpoint: validatedSub.endpoint,
        auth_enc: toByteaLiteral(authSealed),
        p256dh_enc: toByteaLiteral(p256dhSealed),
        auth_enc_b64: toBase64Text(authSealed),
        p256dh_enc_b64: toBase64Text(p256dhSealed),
        ua: sanitizedUa,
      }, {
        onConflict: 'endpoint'
      });

    if (dbError) {
      console.error('[subscribe-push] Database error:', dbError);
      return new Response(
        JSON.stringify({ success: false, error: SAFE_ERRORS.operation_failed }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[subscribe-push] Subscription saved successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    // Log full error server-side, return generic message to client
    console.error('[subscribe-push] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: SAFE_ERRORS.internal_error }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
