export function requireInternal(req: Request): Response | null {
  const got = req.headers.get('x-internal-token');
  const want = Deno.env.get('INTERNAL_FN_TOKEN'); // set in project env
  if (!want || got !== want) {
    // structured log (no secrets)
    console.log(JSON.stringify({
      level: 'warn',
      fn: 'internal-auth',
      blocked: true,
      ip: req.headers.get('x-forwarded-for') || null,
      ua: req.headers.get('user-agent') || null,
    }));
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return null;
}
