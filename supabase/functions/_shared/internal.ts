export function requireInternal(req: Request, fnName = 'internal-auth'): Response | null {
  const token = req.headers.get('x-internal-token');
  const expected = Deno.env.get('INTERNAL_FN_TOKEN');
  const fromCron = req.headers.get('x-cron') === '1';

  if (!fromCron || !expected || token !== expected) {
    console.warn(JSON.stringify({
      level: 'warn',
      fn: fnName,
      blocked: true,
      reason: !fromCron ? 'missing-cron-header' : 'token-mismatch',
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
