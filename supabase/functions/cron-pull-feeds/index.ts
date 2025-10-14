// Public cron wrapper: invokes internal pull-feeds with INTERNAL_FN_TOKEN
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const INTERNAL = Deno.env.get('INTERNAL_FN_TOKEN')

  if (!SUPABASE_URL || !SERVICE_ROLE || !INTERNAL) {
    const msg = { error: 'Missing SUPABASE_URL or SERVICE_ROLE or INTERNAL_FN_TOKEN' }
    return new Response(JSON.stringify(msg), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

  try {
    const { data, error } = await supabase.functions.invoke('pull-feeds', {
      body: {},
      headers: { 'x-internal-token': INTERNAL },
    })
    if (error) throw error
    return new Response(JSON.stringify({ ok: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('cron-pull-feeds error', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})