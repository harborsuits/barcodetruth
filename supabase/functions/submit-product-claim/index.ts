import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limiter
const rateLimitBuckets = new Map<string, { tokens: number; ts: number }>();
function checkRateLimit(ip: string, maxTokens = 5, perMs = 60_000): boolean {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(ip) ?? { tokens: maxTokens, ts: now };
  const elapsed = now - bucket.ts;
  const refill = Math.floor(elapsed / perMs) * maxTokens;
  bucket.tokens = Math.min(maxTokens, bucket.tokens + refill);
  bucket.ts = now;
  
  if (bucket.tokens <= 0) {
    rateLimitBuckets.set(ip, bucket);
    return false;
  }
  
  bucket.tokens--;
  rateLimitBuckets.set(ip, bucket);
  return true;
}

interface ClaimRequest {
  barcode: string;
  brand_id: string;
  product_name?: string;
  source_hint?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  
  // Rate limit: 5 claims per minute per IP
  if (!checkRateLimit(clientIp, 5, 60_000)) {
    console.log(JSON.stringify({ level: "warn", fn: "submit-product-claim", ip: clientIp, msg: "rate_limited" }));
    return new Response(
      JSON.stringify({ error: 'RATE_LIMITED', message: 'Too many submissions. Please wait a minute.' }),
      { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }
      }
    );
  }

  const t0 = performance.now();

  try {
    const authHeader = req.headers.get('Authorization');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader || '' } } }
    );

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'UNAUTHORIZED', message: 'Authentication required to submit claims.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { barcode, brand_id, product_name, source_hint } = await req.json() as ClaimRequest;

    // Validate input
    if (!barcode || typeof barcode !== 'string' || barcode.length < 8 || barcode.length > 14) {
      return new Response(
        JSON.stringify({ error: 'Invalid barcode format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!brand_id || typeof brand_id !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid brand_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize barcode (UPC-A → EAN-13)
    const normalizedBarcode = barcode.length === 12 && /^\d+$/.test(barcode) ? '0' + barcode : barcode;

    // Check if identical claim exists (same barcode + brand_id, not rejected)
    const { data: existingClaim } = await supabase
      .from('product_claims')
      .select('id, status')
      .eq('barcode_ean13', normalizedBarcode)
      .eq('claimed_brand_id', brand_id)
      .in('status', ['pending', 'verified'])
      .maybeSingle();

    if (existingClaim) {
      // Claim exists - add upvote instead of duplicate
      const { data: existingVote } = await supabase
        .from('product_claim_votes')
        .select('vote')
        .eq('claim_id', existingClaim.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingVote) {
        const { error: voteError } = await supabase
          .from('product_claim_votes')
          .insert({
            claim_id: existingClaim.id,
            user_id: user.id,
            vote: 1
          });

        if (voteError) throw voteError;

        const dur = Math.round(performance.now() - t0);
        console.log(JSON.stringify({ 
          level: "info", 
          fn: "submit-product-claim", 
          action: "upvote",
          claim_id: existingClaim.id,
          user_id: user.id,
          dur_ms: dur
        }));

        return new Response(
          JSON.stringify({
            ok: true,
            action: 'upvoted',
            status: existingClaim.status,
            claim_id: existingClaim.id,
            message: 'Your vote has been recorded.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Already voted
        return new Response(
          JSON.stringify({
            ok: true,
            action: 'already_voted',
            status: existingClaim.status,
            claim_id: existingClaim.id,
            message: 'You already voted on this claim.'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Create new claim
    const { data: newClaim, error: insertError } = await supabase
      .from('product_claims')
      .insert({
        barcode_ean13: normalizedBarcode,
        claimed_brand_id: brand_id,
        product_name: product_name || null,
        source_hint: source_hint || 'user_submit',
        created_by: user.id
      })
      .select('id, status, confidence')
      .single();

    if (insertError) throw insertError;

    // Auto-vote on own claim
    await supabase
      .from('product_claim_votes')
      .insert({
        claim_id: newClaim.id,
        user_id: user.id,
        vote: 1
      });

    const dur = Math.round(performance.now() - t0);
    console.log(JSON.stringify({ 
      level: "info", 
      fn: "submit-product-claim", 
      action: "created",
      claim_id: newClaim.id,
      barcode: normalizedBarcode,
      brand_id,
      user_id: user.id,
      dur_ms: dur
    }));

    return new Response(
      JSON.stringify({
        ok: true,
        action: 'created',
        status: newClaim.status,
        claim_id: newClaim.id,
        confidence: newClaim.confidence,
        message: 'Claim submitted successfully. Thank you for improving our database!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const dur = Math.round(performance.now() - t0);
    console.error(JSON.stringify({ 
      level: "error", 
      fn: "submit-product-claim", 
      msg: String(error instanceof Error ? error.message : error),
      dur_ms: dur
    }));
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
