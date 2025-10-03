import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClaimWithScore {
  id: string;
  barcode_ean13: string;
  claimed_brand_id: string;
  product_name: string | null;
  confidence: number;
  score: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Starting auto-accept job...');

    // Fetch pending claims that meet auto-accept criteria:
    // - score ≥ 3
    // - ≥2 distinct upvoters (upvotes - downvotes ≥ 2)
    // - status = 'pending'
    const { data: claims, error: fetchError } = await supabase
      .from('product_claims_moderator')
      .select('*')
      .eq('status', 'pending')
      .gte('score', 3)
      .gte('upvotes', 2) as { data: ClaimWithScore[] | null; error: any };

    if (fetchError) {
      console.error('Error fetching claims:', fetchError);
      throw fetchError;
    }

    if (!claims || claims.length === 0) {
      console.log('✅ No claims meet auto-accept criteria');
      return new Response(
        JSON.stringify({ ok: true, verified: 0, message: 'No claims to auto-accept' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Found ${claims.length} claims eligible for auto-accept`);

    const results = [];
    for (const claim of claims) {
      try {
        // 1. Upsert to products table
        const { error: productError } = await supabase
          .from('products')
          .upsert({
            barcode: claim.barcode_ean13,
            brand_id: claim.claimed_brand_id,
            name: claim.product_name || 'Community Verified Product',
          }, {
            onConflict: 'barcode',
          });

        if (productError) {
          console.error(`Failed to upsert product for claim ${claim.id}:`, productError);
          results.push({ claim_id: claim.id, success: false, error: productError.message });
          continue;
        }

        // 2. Update claim status to 'verified'
        const { error: updateError } = await supabase
          .from('product_claims')
          .update({
            status: 'verified',
            moderated_at: new Date().toISOString(),
            moderated_by: null, // auto-verified (no specific moderator)
          })
          .eq('id', claim.id);

        if (updateError) {
          console.error(`Failed to update claim ${claim.id}:`, updateError);
          results.push({ claim_id: claim.id, success: false, error: updateError.message });
          continue;
        }

        console.log(`✅ Auto-verified claim ${claim.id} (barcode: ${claim.barcode_ean13})`);
        results.push({ claim_id: claim.id, success: true, barcode: claim.barcode_ean13 });
      } catch (err) {
        console.error(`Error processing claim ${claim.id}:`, err);
        results.push({ claim_id: claim.id, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`🎉 Auto-accept job complete: ${successCount}/${results.length} verified`);

    return new Response(
      JSON.stringify({
        ok: true,
        verified: successCount,
        total: results.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Auto-accept job failed:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
