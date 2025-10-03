import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ScoringWeights = Record<string, number>;
type ScoringCaps = Record<string, number>;

interface BaselineInputs24m {
  brand_id: string;
  brand_name: string;
  labor_violations_24m: number;
  labor_fines_24m: number;
  labor_sentiment_24m: number;
  labor_fatalities_24m: number;
  env_actions_24m: number;
  env_superfund_active: number;
  env_emissions_percentile: number;
  env_certifications: number;
  pol_donations_24m: number;
  pol_dem_donations_24m: number;
  pol_rep_donations_24m: number;
  pol_lobbying_24m: number;
  social_recalls_class1_24m: number;
  social_recalls_class2_24m: number;
  social_recalls_class3_24m: number;
  social_lawsuits_24m: number;
  social_sentiment_avg: number;
  total_events_24m: number;
  distinct_sources_24m: number;
  events_last_12m: number;
}

interface BaselineInputs90d {
  brand_id: string;
  labor_violations_90d: number;
  labor_fines_90d: number;
  labor_fatalities_90d: number;
  env_actions_90d: number;
  pol_donations_90d: number;
  pol_dem_donations_90d: number;
  pol_rep_donations_90d: number;
  social_recalls_class1_90d: number;
  social_recalls_class2_90d: number;
  social_recalls_class3_90d: number;
  social_lawsuits_90d: number;
  total_events_90d: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getWeight(weights: ScoringWeights, key: string, fallback: number): number {
  return weights[key] ?? fallback;
}

function getCap(caps: ScoringCaps, key: string, fallback: number): number {
  return caps[key] ?? fallback;
}

function calculateLaborScore(
  inputs: BaselineInputs24m | BaselineInputs90d,
  weights: ScoringWeights,
  caps: ScoringCaps,
  is90d = false
): { score: number; reason: string; inputs: Record<string, number> } {
  const suffix = is90d ? '_90d' : '_24m';
  const violations = (inputs as any)[`labor_violations${suffix}`] || 0;
  const fines = (inputs as any)[`labor_fines${suffix}`] || 0;
  const sentiment = (inputs as any)[`labor_sentiment${suffix}`] || 3; // default neutral
  const fatalities = (inputs as any)[`labor_fatalities${suffix}`] || 0;

  const start = getCap(caps, 'labor.start', 70);
  
  // Violations
  const violPt = getWeight(weights, 'labor.osha.violation_pt', -6);
  const violCap = getWeight(weights, 'labor.osha.violation_cap', -40);
  const laborViol = Math.max(violPt * violations, violCap);
  
  // Fines (log scale)
  const fineBase = getWeight(weights, 'labor.fines.log_base', 10000);
  const fineMult = getWeight(weights, 'labor.fines.multiplier', -5);
  const fineCap = getWeight(weights, 'labor.fines.cap', -20);
  const F = Math.max(fines, 1);
  const laborFines = fines < fineBase ? 0 : Math.max(fineMult * Math.log10(F / fineBase), fineCap);
  
  // Sentiment
  const sentMult = getWeight(weights, 'labor.sentiment.multiplier', 15);
  const sentCapPos = getWeight(weights, 'labor.sentiment.cap_pos', 30);
  const sentCapNeg = getWeight(weights, 'labor.sentiment.cap_neg', -30);
  const laborSent = clamp((sentiment - 3) * sentMult, sentCapNeg, sentCapPos);
  
  // Severe incidents
  const severeMult = getWeight(weights, 'labor.severe.multiplier', -15);
  const severeCap = getWeight(weights, 'labor.severe.cap', -30);
  const laborSevere = Math.max(severeMult * fatalities, severeCap);
  
  const score = clamp(
    start + laborViol + laborFines + laborSent + laborSevere,
    getCap(caps, 'labor.min', 0),
    getCap(caps, 'labor.max', 100)
  );
  
  const reasonParts = [];
  if (violations > 0) reasonParts.push(`${violations} OSHA violation${violations > 1 ? 's' : ''}`);
  if (fines > 0) reasonParts.push(`$${Math.round(fines).toLocaleString()} in fines`);
  if (sentiment !== 3) reasonParts.push(`worker rating ${sentiment.toFixed(1)}/5`);
  if (fatalities > 0) reasonParts.push(`${fatalities} severe incident${fatalities > 1 ? 's' : ''}`);
  
  const reason = reasonParts.length > 0 
    ? reasonParts.join(', ')
    : 'No significant labor issues in window';
  
  return {
    score: Math.round(score),
    reason,
    inputs: { violations, fines, sentiment, fatalities }
  };
}

function calculateEnvironmentScore(
  inputs: BaselineInputs24m | BaselineInputs90d,
  weights: ScoringWeights,
  caps: ScoringCaps,
  is90d = false
): { score: number; reason: string; inputs: Record<string, number> } {
  const suffix = is90d ? '_90d' : '_24m';
  const actions = (inputs as any)[`env_actions${suffix}`] || 0;
  const superfund = (inputs as BaselineInputs24m).env_superfund_active || 0;
  const emissions = (inputs as BaselineInputs24m).env_emissions_percentile || 50;
  const certs = (inputs as BaselineInputs24m).env_certifications || 0;

  const start = getCap(caps, 'environment.start', 70);
  
  // EPA actions
  const actionPt = getWeight(weights, 'env.epa.action_pt', -7);
  const actionCap = getWeight(weights, 'env.epa.cap', -35);
  const envEpa = Math.max(actionPt * actions, actionCap);
  
  // Superfund
  const superfundPt = getWeight(weights, 'env.superfund.site_pt', -10);
  const superfundCap = getWeight(weights, 'env.superfund.cap', -30);
  const envNpl = Math.max(superfundPt * superfund, superfundCap);
  
  // Emissions (only for 24m)
  const emitMult = getWeight(weights, 'env.emissions.multiplier', -0.4);
  const emitCapNeg = getWeight(weights, 'env.emissions.cap_neg', -20);
  const emitCapPos = getWeight(weights, 'env.emissions.cap_pos', 20);
  const envEmit = is90d ? 0 : clamp(emitMult * (emissions - 50), emitCapNeg, emitCapPos);
  
  // Certifications (only for 24m)
  const certPt = getWeight(weights, 'env.cert.cert_pt', 5);
  const certCap = getWeight(weights, 'env.cert.cap', 15);
  const envPos = is90d ? 0 : Math.min(certPt * certs, certCap);
  
  const score = clamp(
    start + envEpa + envNpl + envEmit + envPos,
    getCap(caps, 'environment.min', 0),
    getCap(caps, 'environment.max', 100)
  );
  
  const reasonParts = [];
  if (actions > 0) reasonParts.push(`${actions} EPA action${actions > 1 ? 's' : ''}`);
  if (superfund > 0) reasonParts.push(`${superfund} Superfund site${superfund > 1 ? 's' : ''}`);
  if (!is90d && emissions !== 50) reasonParts.push(`emissions ${emissions}th percentile`);
  if (!is90d && certs > 0) reasonParts.push(`${certs} certification${certs > 1 ? 's' : ''}`);
  
  const reason = reasonParts.length > 0
    ? reasonParts.join(', ')
    : 'No significant environmental issues in window';
  
  return {
    score: Math.round(score),
    reason,
    inputs: { actions, superfund, emissions, certs }
  };
}

function calculatePoliticsScore(
  inputs: BaselineInputs24m | BaselineInputs90d,
  weights: ScoringWeights,
  caps: ScoringCaps,
  is90d = false
): { score: number; reason: string; inputs: Record<string, number> } {
  const suffix = is90d ? '_90d' : '_24m';
  const donations = (inputs as any)[`pol_donations${suffix}`] || 0;
  const demDonations = (inputs as any)[`pol_dem_donations${suffix}`] || 0;
  const repDonations = (inputs as any)[`pol_rep_donations${suffix}`] || 0;
  const lobbying = (inputs as BaselineInputs24m).pol_lobbying_24m || 0;

  const start = getCap(caps, 'politics.start', 70);
  
  // Partisan tilt
  const totalPolitical = demDonations + repDonations;
  const demPct = totalPolitical > 0 ? (demDonations / totalPolitical) * 100 : 50;
  const tilt = Math.abs(demPct - 50);
  const tiltMult = getWeight(weights, 'pol.tilt.multiplier', -0.5);
  const tiltCap = getWeight(weights, 'pol.tilt.cap', -25);
  const polTilt = Math.max(tiltMult * tilt, tiltCap);
  
  // Donation magnitude
  const donBase = getWeight(weights, 'pol.donations.log_base', 100000);
  const donMult = getWeight(weights, 'pol.donations.multiplier', -3);
  const donCap = getWeight(weights, 'pol.donations.cap', -15);
  const G = Math.max(donations, 1);
  const polAmt = donations < donBase ? 0 : Math.max(donMult * Math.log10(G / donBase), donCap);
  
  // Lobbying (only for 24m)
  const lobbyBase = getWeight(weights, 'pol.lobbying.log_base', 250000);
  const lobbyMult = getWeight(weights, 'pol.lobbying.multiplier', -2.5);
  const lobbyCap = getWeight(weights, 'pol.lobbying.cap', -12.5);
  const L = Math.max(lobbying, 1);
  const polLobby = is90d || lobbying < lobbyBase ? 0 : Math.max(lobbyMult * Math.log10(L / lobbyBase), lobbyCap);
  
  const score = clamp(
    start + polTilt + polAmt + polLobby,
    getCap(caps, 'politics.min', 0),
    getCap(caps, 'politics.max', 100)
  );
  
  const reasonParts = [];
  if (totalPolitical > 0) {
    reasonParts.push(`$${Math.round(donations).toLocaleString()} donations`);
    reasonParts.push(`${Math.round(demPct)}% Dem / ${Math.round(100-demPct)}% Rep`);
  }
  if (!is90d && lobbying > 0) reasonParts.push(`$${Math.round(lobbying).toLocaleString()} lobbying`);
  
  const reason = reasonParts.length > 0
    ? reasonParts.join(', ')
    : 'No political spending in window';
  
  return {
    score: Math.round(score),
    reason,
    inputs: { donations, demDonations, repDonations, lobbying }
  };
}

function calculateSocialScore(
  inputs: BaselineInputs24m | BaselineInputs90d,
  weights: ScoringWeights,
  caps: ScoringCaps,
  is90d = false
): { score: number; reason: string; inputs: Record<string, number> } {
  const suffix = is90d ? '_90d' : '_24m';
  const class1 = (inputs as any)[`social_recalls_class1${suffix}`] || 0;
  const class2 = (inputs as any)[`social_recalls_class2${suffix}`] || 0;
  const class3 = (inputs as any)[`social_recalls_class3${suffix}`] || 0;
  const lawsuits = (inputs as any)[`social_lawsuits${suffix}`] || 0;
  const sentiment = (inputs as BaselineInputs24m).social_sentiment_avg || 0;

  const start = getCap(caps, 'social.start', 70);
  
  // Recalls
  const c1Pt = getWeight(weights, 'social.recall.class1_pt', -15);
  const c2Pt = getWeight(weights, 'social.recall.class2_pt', -8);
  const c3Pt = getWeight(weights, 'social.recall.class3_pt', -3);
  const recallCap = getWeight(weights, 'social.recall.cap', -30);
  const socRecalls = Math.max(c1Pt * class1 + c2Pt * class2 + c3Pt * class3, recallCap);
  
  // Lawsuits
  const casePt = getWeight(weights, 'social.lawsuits.case_pt', -10);
  const caseCap = getWeight(weights, 'social.lawsuits.cap', -30);
  const socLaw = Math.max(casePt * lawsuits, caseCap);
  
  // Sentiment (news tone, -1 to +1)
  const sentMult = getWeight(weights, 'social.sentiment.multiplier', 15);
  const sentCapPos = getWeight(weights, 'social.sentiment.cap_pos', 15);
  const sentCapNeg = getWeight(weights, 'social.sentiment.cap_neg', -15);
  const socSent = is90d ? 0 : clamp(sentiment * sentMult, sentCapNeg, sentCapPos);
  
  const score = clamp(
    start + socRecalls + socLaw + socSent,
    getCap(caps, 'social.min', 0),
    getCap(caps, 'social.max', 100)
  );
  
  const reasonParts = [];
  const totalRecalls = class1 + class2 + class3;
  if (totalRecalls > 0) reasonParts.push(`${totalRecalls} recall${totalRecalls > 1 ? 's' : ''}`);
  if (lawsuits > 0) reasonParts.push(`${lawsuits} lawsuit${lawsuits > 1 ? 's' : ''}`);
  if (!is90d && sentiment !== 0) reasonParts.push(`news tone ${sentiment > 0 ? '+' : ''}${sentiment.toFixed(2)}`);
  
  const reason = reasonParts.length > 0
    ? reasonParts.join(', ')
    : 'No significant social issues in window';
  
  return {
    score: Math.round(score),
    reason,
    inputs: { class1, class2, class3, lawsuits, sentiment }
  };
}

function calculateConfidence(
  inputs24m: BaselineInputs24m,
  category: 'labor' | 'environment' | 'politics' | 'social',
  weights: ScoringWeights
): number {
  const expectedInputs = {
    labor: 4,
    environment: 4,
    politics: 2,
    social: 3
  };
  
  // Coverage: how many inputs are non-zero
  let presentInputs = 0;
  if (category === 'labor') {
    if (inputs24m.labor_violations_24m > 0) presentInputs++;
    if (inputs24m.labor_fines_24m > 0) presentInputs++;
    if (inputs24m.labor_sentiment_24m !== 0) presentInputs++;
    if (inputs24m.labor_fatalities_24m > 0) presentInputs++;
  } else if (category === 'environment') {
    if (inputs24m.env_actions_24m > 0) presentInputs++;
    if (inputs24m.env_superfund_active > 0) presentInputs++;
    if (inputs24m.env_emissions_percentile !== 50) presentInputs++;
    if (inputs24m.env_certifications > 0) presentInputs++;
  } else if (category === 'politics') {
    if (inputs24m.pol_donations_24m > 0) presentInputs++;
    if (inputs24m.pol_lobbying_24m > 0) presentInputs++;
  } else if (category === 'social') {
    const recalls = inputs24m.social_recalls_class1_24m + inputs24m.social_recalls_class2_24m + inputs24m.social_recalls_class3_24m;
    if (recalls > 0) presentInputs++;
    if (inputs24m.social_lawsuits_24m > 0) presentInputs++;
    if (inputs24m.social_sentiment_avg !== 0) presentInputs++;
  }
  
  const coverage = (presentInputs / expectedInputs[category]) * 100;
  
  // Recency: share of events from last 12 months
  const recency = inputs24m.total_events_24m > 0 
    ? (inputs24m.events_last_12m / inputs24m.total_events_24m) * 100 
    : 50; // neutral if no events
  
  // Corroboration: distinct sources (cap at 4)
  const corroboration = Math.min(inputs24m.distinct_sources_24m, 4) / 4 * 100;
  
  // Stability: assume moderate stability for now (TODO: calculate rolling stdev)
  const stability = 70;
  
  const covWeight = getWeight(weights, 'confidence.coverage.weight', 0.40);
  const recWeight = getWeight(weights, 'confidence.recency.weight', 0.30);
  const corrWeight = getWeight(weights, 'confidence.corroboration.weight', 0.20);
  const stabWeight = getWeight(weights, 'confidence.stability.weight', 0.10);
  
  const confidence = covWeight * coverage + recWeight * recency + corrWeight * corroboration + stabWeight * stability;
  
  return Math.round(confidence);
}

serve(async (req) => {
  const startTime = performance.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { brandId, mode } = body;

    // Load config once (needed for both modes)
    const { data: weightsData } = await supabase.from('scoring_weights').select('key, value');
    const { data: capsData } = await supabase.from('scoring_caps').select('key, value');
    
    const weights: ScoringWeights = {};
    const caps: ScoringCaps = {};
    
    weightsData?.forEach(w => weights[w.key] = w.value);
    capsData?.forEach(c => caps[c.key] = c.value);

    // Support batch mode for cron jobs
    if (mode === 'batch') {
      console.log('🔄 Starting batch baseline calculation for all brands...');
      
      const { data: brands, error: brandsError } = await supabase
        .from('brands')
        .select('id, name')
        .limit(1000); // Process in chunks

      if (brandsError) throw brandsError;

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const brand of brands || []) {
        try {
          await calculateAndStoreBrand(supabase, brand.id, weights, caps);
          successCount++;
        } catch (err) {
          errorCount++;
          const errMsg = err instanceof Error ? err.message : String(err);
          errors.push(`${brand.name}: ${errMsg}`);
          console.error(`❌ Failed for ${brand.name}:`, errMsg);
        }
      }

      const duration = Math.round(performance.now() - startTime);
      console.log(JSON.stringify({
        level: 'info',
        fn: 'calculate-baselines-batch',
        success: successCount,
        errors: errorCount,
        total: brands?.length || 0,
        duration_ms: duration,
      }));

      return new Response(
        JSON.stringify({ 
          success: true, 
          processed: successCount,
          errors: errorCount,
          error_details: errors.slice(0, 10),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Single brand mode
    if (!brandId) {
      return new Response(
        JSON.stringify({ error: 'brandId required for single brand mode' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await calculateAndStoreBrand(supabase, brandId, weights, caps);
    
    const duration = Math.round(performance.now() - startTime);
    console.log(JSON.stringify({
      level: 'info',
      fn: 'calculate-baselines',
      brandId,
      scores: {
        labor: result.breakdown.labor.value,
        environment: result.breakdown.environment.value,
        politics: result.breakdown.politics.value,
        social: result.breakdown.social.value,
      },
      duration_ms: duration,
    }));

    return new Response(
      JSON.stringify({ success: true, breakdown: result.breakdown }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const duration = Math.round(performance.now() - startTime);
    console.error(JSON.stringify({
      level: 'error',
      fn: 'calculate-baselines',
      error: error instanceof Error ? error.message : 'Unknown error',
      duration_ms: duration,
    }));
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Extract calculation logic into reusable function
async function calculateAndStoreBrand(
  supabase: any,
  brandId: string,
  weights: ScoringWeights,
  caps: ScoringCaps
) {

  // Fetch baseline inputs
  const { data: inputs24m, error: err24m } = await supabase
    .from('v_baseline_inputs_24m')
    .select('*')
    .eq('brand_id', brandId)
    .single();

  if (err24m || !inputs24m) {
    throw new Error(`Brand not found or no baseline data: ${err24m?.message || 'unknown'}`);
  }

  const { data: inputs90d } = await supabase
    .from('v_baseline_inputs_90d')
    .select('*')
    .eq('brand_id', brandId)
    .single();

  // Calculate category scores
  const labor24m = calculateLaborScore(inputs24m, weights, caps);
  const labor90d = inputs90d ? calculateLaborScore(inputs90d, weights, caps, true) : labor24m;
  const laborDelta = clamp(
    labor90d.score - labor24m.score,
    getWeight(weights, 'window.delta.cap_neg', -15),
    getWeight(weights, 'window.delta.cap_pos', 15)
  );

  const env24m = calculateEnvironmentScore(inputs24m, weights, caps);
  const env90d = inputs90d ? calculateEnvironmentScore(inputs90d, weights, caps, true) : env24m;
  const envDelta = clamp(
    env90d.score - env24m.score,
    getWeight(weights, 'window.delta.cap_neg', -15),
    getWeight(weights, 'window.delta.cap_pos', 15)
  );

  const pol24m = calculatePoliticsScore(inputs24m, weights, caps);
  const pol90d = inputs90d ? calculatePoliticsScore(inputs90d, weights, caps, true) : pol24m;
  const polDelta = clamp(
    pol90d.score - pol24m.score,
    getWeight(weights, 'window.delta.cap_neg', -15),
    getWeight(weights, 'window.delta.cap_pos', 15)
  );

  const soc24m = calculateSocialScore(inputs24m, weights, caps);
  const soc90d = inputs90d ? calculateSocialScore(inputs90d, weights, caps, true) : soc24m;
  const socDelta = clamp(
    soc90d.score - soc24m.score,
    getWeight(weights, 'window.delta.cap_neg', -15),
    getWeight(weights, 'window.delta.cap_pos', 15)
  );

  // Calculate confidence scores
  const laborConf = calculateConfidence(inputs24m, 'labor', weights);
  const envConf = calculateConfidence(inputs24m, 'environment', weights);
  const polConf = calculateConfidence(inputs24m, 'politics', weights);
  const socConf = calculateConfidence(inputs24m, 'social', weights);

  // Check for suspicious jumps
  const maxJump = Math.max(
    Math.abs(laborDelta),
    Math.abs(envDelta),
    Math.abs(polDelta),
    Math.abs(socDelta)
  );
  
  if (maxJump > 12) {
    console.warn(JSON.stringify({
      level: 'warn',
      fn: 'calculate-baselines',
      brandId,
      msg: 'Large score jump detected',
      maxJump,
      deltas: { laborDelta, envDelta, polDelta, socDelta },
    }));
  }

  // Build breakdown (using snake_case to match ScoreBreakdown component)
  const breakdown = {
    labor: {
      component: 'labor',
      base: labor24m.score,
      base_reason: labor24m.reason,
      window_delta: laborDelta,
      value: labor24m.score + laborDelta,
      confidence: laborConf,
      evidence_count: inputs24m.total_events_24m || 0,
      verified_count: 0, // TODO: count verified sources
      independent_owners: 0, // TODO: count distinct owners
      proof_required: false, // TODO: implement proof gate logic
      inputs: labor24m.inputs,
      last_updated: new Date().toISOString()
    },
    environment: {
      component: 'environment',
      base: env24m.score,
      base_reason: env24m.reason,
      window_delta: envDelta,
      value: env24m.score + envDelta,
      confidence: envConf,
      evidence_count: inputs24m.total_events_24m || 0,
      verified_count: 0,
      independent_owners: 0,
      proof_required: false,
      inputs: env24m.inputs,
      last_updated: new Date().toISOString()
    },
    politics: {
      component: 'politics',
      base: pol24m.score,
      base_reason: pol24m.reason,
      window_delta: polDelta,
      value: pol24m.score + polDelta,
      confidence: polConf,
      evidence_count: inputs24m.total_events_24m || 0,
      verified_count: 0,
      independent_owners: 0,
      proof_required: false,
      inputs: pol24m.inputs,
      last_updated: new Date().toISOString()
    },
    social: {
      component: 'social',
      base: soc24m.score,
      base_reason: soc24m.reason,
      window_delta: socDelta,
      value: soc24m.score + socDelta,
      confidence: socConf,
      evidence_count: inputs24m.total_events_24m || 0,
      verified_count: 0,
      independent_owners: 0,
      proof_required: false,
      inputs: soc24m.inputs,
      last_updated: new Date().toISOString()
    }
  };

  // Update brand_scores
  await supabase
    .from('brand_scores')
    .upsert({
      brand_id: brandId,
      score_labor: breakdown.labor.value,
      score_environment: breakdown.environment.value,
      score_politics: breakdown.politics.value,
      score_social: breakdown.social.value,
      breakdown: breakdown,
      last_updated: new Date().toISOString(),
      window_start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      window_end: new Date().toISOString()
    }, { onConflict: 'brand_id' });

  return { breakdown };
}