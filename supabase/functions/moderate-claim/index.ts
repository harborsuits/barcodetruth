import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ModerateRequest {
  claim_id: string;
  action: 'verify' | 'reject';
  rejection_reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin role required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { claim_id, action, rejection_reason } = await req.json() as ModerateRequest;

    if (!claim_id || !action) {
      throw new Error('Missing required fields: claim_id, action');
    }

    if (action !== 'verify' && action !== 'reject') {
      throw new Error('Invalid action. Must be "verify" or "reject"');
    }

    console.log(`Moderating claim ${claim_id}: ${action}`);

    // Fetch the claim
    const { data: claim, error: fetchError } = await supabase
      .from('product_claims')
      .select('*')
      .eq('id', claim_id)
      .single();

    if (fetchError || !claim) {
      throw new Error('Claim not found');
    }

    if (action === 'verify') {
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
        throw new Error(`Failed to create product: ${productError.message}`);
      }

      // 2. Update claim to verified
      const { error: updateError } = await supabase
        .from('product_claims')
        .update({
          status: 'verified',
          moderated_at: new Date().toISOString(),
          moderated_by: user.id,
        })
        .eq('id', claim_id);

      if (updateError) {
        throw new Error(`Failed to verify claim: ${updateError.message}`);
      }

      console.log(`✅ Verified claim ${claim_id}`);
      return new Response(
        JSON.stringify({ ok: true, action: 'verified', claim_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Reject
      const { error: updateError } = await supabase
        .from('product_claims')
        .update({
          status: 'rejected',
          moderated_at: new Date().toISOString(),
          moderated_by: user.id,
          rejection_reason: rejection_reason || 'Rejected by moderator',
        })
        .eq('id', claim_id);

      if (updateError) {
        throw new Error(`Failed to reject claim: ${updateError.message}`);
      }

      console.log(`❌ Rejected claim ${claim_id}: ${rejection_reason}`);
      return new Response(
        JSON.stringify({ ok: true, action: 'rejected', claim_id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Moderation error:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      {
        status: error.message.includes('Unauthorized') ? 403 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
