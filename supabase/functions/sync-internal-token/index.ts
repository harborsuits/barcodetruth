// Sync INTERNAL_FN_TOKEN from Edge env into the database table _secrets_internal
// Public but harmless: it only writes the same token value from env to DB (no exposure)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const TOKEN = Deno.env.get('INTERNAL_FN_TOKEN');

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !TOKEN) {
    const msg = {
      ok: false,
      error: 'Missing SUPABASE_URL or SERVICE_ROLE_KEY or INTERNAL_FN_TOKEN env',
    };
    return new Response(JSON.stringify(msg), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  try {
    // Upsert token into DB secret table so DB-driven callers (pg_net/cron) use the same value as Edge env
    const { error } = await supabase
      .from('_secrets_internal')
      .upsert({ key: 'INTERNAL_FN_TOKEN', val: TOKEN }, { onConflict: 'key' });

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
