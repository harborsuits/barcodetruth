// Public cron wrapper: invokes internal resolve-evidence-links with INTERNAL_FN_TOKEN
// Uses direct fetch to include query params

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const PROJECT_URL = Deno.env.get('SUPABASE_URL')
  const INTERNAL = Deno.env.get('INTERNAL_FN_TOKEN')

  if (!PROJECT_URL || !INTERNAL) {
    const msg = { error: 'Missing SUPABASE_URL or INTERNAL_FN_TOKEN' }
    return new Response(JSON.stringify(msg), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const url = `${PROJECT_URL}/functions/v1/resolve-evidence-links?mode=agency-first&limit=300`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-internal-token': INTERNAL, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const text = await res.text()
    const payload = (() => { try { return JSON.parse(text) } catch { return { raw: text } } })()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
    return new Response(JSON.stringify({ ok: true, data: payload }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('cron-resolve-evidence error', err)
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})