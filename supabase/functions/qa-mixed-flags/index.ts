import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiting: 30s between runs per user
const lastRunMap = new Map<string, number>();

interface QAResult {
  fn: string;
  brands_tested: number;
  mixed_found: number;
  caps_ok: boolean;
  duration_ms: number;
  checks: {
    name: string;
    status: 'PASS' | 'FAIL' | 'WARNING';
    message: string;
  }[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limiting: 30s between runs
    const lastRun = lastRunMap.get(user.id) || 0;
    if (Date.now() - lastRun < 30_000) {
      return new Response(JSON.stringify({ error: 'Please wait 30s between QA runs' }), {
        status: 429,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': '30'
        },
      });
    }
    lastRunMap.set(user.id, Date.now());

    const result: QAResult = {
      fn: 'qa-mixed-flags',
      brands_tested: 0,
      mixed_found: 0,
      caps_ok: true,
      duration_ms: 0,
      checks: [],
    };

    // CHECK 1: Verify mixed event counts exist in v_baseline_inputs_90d
    const { data: mixedInputs, error: inputsError } = await supabase
      .from('v_baseline_inputs_90d')
      .select('brand_id, labor_mixed_90d, env_mixed_90d, pol_mixed_90d, social_mixed_90d')
      .or('labor_mixed_90d.gt.0,env_mixed_90d.gt.0,pol_mixed_90d.gt.0,social_mixed_90d.gt.0')
      .limit(100);

    if (inputsError) {
      result.checks.push({
        name: 'Mixed inputs view',
        status: 'FAIL',
        message: `Error querying v_baseline_inputs_90d: ${inputsError.message}`,
      });
    } else {
      result.checks.push({
        name: 'Mixed inputs view',
        status: 'PASS',
        message: `Found ${mixedInputs?.length || 0} brands with mixed events in 90d window`,
      });
    }

    // CHECK 2: Verify scoring weights exist
    const { data: weights, error: weightsError } = await supabase
      .from('scoring_weights')
      .select('key, value')
      .in('key', ['window.mixed.pt', 'window.mixed.cap']);

    if (weightsError || !weights || weights.length !== 2) {
      result.checks.push({
        name: 'Scoring weights',
        status: 'FAIL',
        message: `Missing or incomplete scoring weights for mixed events`,
      });
    } else {
      result.checks.push({
        name: 'Scoring weights',
        status: 'PASS',
        message: `Mixed event weights configured: ${weights.map(w => `${w.key}=${w.value}`).join(', ')}`,
      });
    }

    // CHECK 3: Verify feature flags exist
    const { data: switches, error: switchesError } = await supabase
      .from('scoring_switches')
      .select('key, enabled')
      .in('key', ['politics_alignment_penalty', 'news_tone_enabled']);

    if (switchesError || !switches || switches.length !== 2) {
      result.checks.push({
        name: 'Feature flags',
        status: 'FAIL',
        message: `Missing or incomplete feature flags`,
      });
    } else {
      result.checks.push({
        name: 'Feature flags',
        status: 'PASS',
        message: `Flags configured: ${switches.map(s => `${s.key}=${s.enabled}`).join(', ')}`,
      });
    }

    // CHECK 4: Verify mixed events reflected in brand_scores breakdown
    const { data: brandScores } = await supabase
      .from('brand_scores')
      .select('brand_id, breakdown')
      .limit(1000);

    const brandsWithMixed = brandScores?.filter(bs => {
      const bd = bs.breakdown as any;
      return (
        (bd?.labor?.window_inputs?.labor_mixed_90d || 0) > 0 ||
        (bd?.environment?.window_inputs?.env_mixed_90d || 0) > 0 ||
        (bd?.politics?.window_inputs?.pol_mixed_90d || 0) > 0 ||
        (bd?.social?.window_inputs?.social_mixed_90d || 0) > 0
      );
    }) || [];

    result.mixed_found = brandsWithMixed.length;
    result.brands_tested = brandScores?.length || 0;

    if (brandsWithMixed.length === 0) {
      result.checks.push({
        name: 'Mixed events in breakdown',
        status: 'WARNING',
        message: `No mixed events found in breakdown.window_inputs (may be expected if no mixed events exist)`,
      });
    } else {
      result.checks.push({
        name: 'Mixed events in breakdown',
        status: 'PASS',
        message: `${brandsWithMixed.length} brand(s) have mixed events reflected in breakdown`,
      });
    }

    // CHECK 5: Verify cap is respected
    const violatingCaps = brandScores?.filter(bs => {
      const bd = bs.breakdown as any;
      const laborMixed = bd?.labor?.window_inputs?.labor_mixed_90d || 0;
      const laborDelta = bd?.labor?.window_delta || 0;
      return laborMixed >= 6 && laborDelta < -3;
    }) || [];

    if (violatingCaps.length > 0) {
      result.caps_ok = false;
      result.checks.push({
        name: 'Mixed penalty cap',
        status: 'FAIL',
        message: `${violatingCaps.length} brand(s) have labor mixed delta exceeding cap (-3)`,
      });
    } else {
      result.checks.push({
        name: 'Mixed penalty cap',
        status: 'PASS',
        message: `Mixed penalty cap (-3) is respected across all brands`,
      });
    }

    result.duration_ms = Date.now() - startTime;

    // Compact log for monitoring
    console.log(JSON.stringify({
      level: 'info',
      fn: 'qa-mixed-flags',
      brands_tested: result.brands_tested,
      mixed_found: result.mixed_found,
      caps_ok: result.caps_ok,
      duration_ms: result.duration_ms
    }));

    console.log(JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('QA validation error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        fn: 'qa-mixed-flags',
        duration_ms: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
