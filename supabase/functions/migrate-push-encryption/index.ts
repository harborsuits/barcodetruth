import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { seal, toByteaLiteral, toBase64Text } from "../_shared/crypto.ts";

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

    // Admin auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check admin role
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!role) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403,
        }
      );
    }

    console.log('[migrate-push-encryption] Starting migration...');

    // Fetch rows with plaintext but missing encrypted versions
    const { data: rows, error: fetchError } = await supabase
      .from('user_push_subs')
      .select('user_id, endpoint, auth, p256dh, auth_enc_b64, p256dh_enc_b64')
      .not('auth', 'is', null)
      .not('p256dh', 'is', null)
      .limit(1000);

    if (fetchError) {
      console.error('[migrate-push-encryption] Fetch error:', fetchError);
      throw fetchError;
    }

    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows ?? []) {
      // Skip if already encrypted
      if (row.auth_enc_b64 && row.p256dh_enc_b64) {
        skipped++;
        continue;
      }

      try {
        const authSealed = await seal(row.auth);
        const p256dhSealed = await seal(row.p256dh);

        const { error: updateError } = await supabase
          .from('user_push_subs')
          .update({
            auth_enc: toByteaLiteral(authSealed),
            p256dh_enc: toByteaLiteral(p256dhSealed),
            auth_enc_b64: toBase64Text(authSealed),
            p256dh_enc_b64: toBase64Text(p256dhSealed),
          })
          .eq('user_id', row.user_id)
          .eq('endpoint', row.endpoint);

        if (updateError) {
          console.error('[migrate-push-encryption] Update failed:', row.endpoint, updateError);
          errors.push(`${row.endpoint}: ${updateError.message}`);
        } else {
          migrated++;
          console.log('[migrate-push-encryption] Migrated:', row.endpoint);
        }
      } catch (e) {
        console.error('[migrate-push-encryption] Encryption failed:', row.endpoint, e);
        const errorMsg = e instanceof Error ? e.message : String(e);
        errors.push(`${row.endpoint}: ${errorMsg}`);
      }
    }

    console.log('[migrate-push-encryption] Complete:', { migrated, skipped, errors: errors.length });

    return new Response(
      JSON.stringify({
        success: true,
        migrated,
        skipped,
        total: (rows ?? []).length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[migrate-push-encryption] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
