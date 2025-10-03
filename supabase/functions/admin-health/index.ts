import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const rateLimitBucket = new Map<string, { timestamp: number; count: number }>();

function allowRequest(identifier: string, maxRequests = 5, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = rateLimitBucket.get(identifier) ?? { timestamp: now, count: 0 };
  
  if (now - bucket.timestamp > windowMs) {
    bucket.timestamp = now;
    bucket.count = 0;
  }
  
  if (bucket.count >= maxRequests) return false;
  
  bucket.count++;
  rateLimitBucket.set(identifier, bucket);
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const t0 = performance.now();

  try {
    // Admin authentication
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authedClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await authedClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await authedClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    if (!allowRequest(user.id, 5, 60_000)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded - max 5 requests per minute' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': '60'
          } 
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch last 20 runs
    const { data: runs } = await supabase
      .from('job_runs')
      .select('*')
      .eq('job_name', 'calculate-baselines')
      .order('started_at', { ascending: false })
      .limit(20);

    // Fetch last 50 anomalies with brand names
    const { data: anomalies } = await supabase
      .from('job_anomalies')
      .select('id, job_run_id, brand_id, category, delta, created_at, brands(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    // Calculate aggregates
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    const totals = {
      last24h_runs: (runs ?? []).filter(r => 
        now - new Date(r.started_at).getTime() < day
      ).length,
      last24h_anomalies: (anomalies ?? []).filter(a => 
        now - new Date(a.created_at).getTime() < day
      ).length,
      total_errors_24h: (runs ?? [])
        .filter(r => now - new Date(r.started_at).getTime() < day)
        .reduce((sum, r) => sum + (r.error_count || 0), 0),
    };

    const duration = Math.round(performance.now() - t0);
    
    console.log(JSON.stringify({
      level: 'info',
      fn: 'admin-health',
      user_id: user.id,
      status: 'success',
      duration_ms: duration,
    }));

    return new Response(
      JSON.stringify({ runs, anomalies, totals }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = Math.round(performance.now() - t0);
    console.error(JSON.stringify({
      level: 'error',
      fn: 'admin-health',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: duration,
    }));
    
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
