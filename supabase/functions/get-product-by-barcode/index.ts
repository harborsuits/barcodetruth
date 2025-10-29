import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { barcode } = await req.json();

    if (!barcode) {
      return new Response(
        JSON.stringify({ error: 'barcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Call the RPC function - return the first row if any
    const { data, error } = await supabase
      .rpc('get_product_by_barcode', { p_raw_gtin: barcode });

    if (error) {
      console.error('RPC error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rows = (data ?? []) as any[];

    if (!rows || rows.length === 0) {
      // Product not found in database - return 200 with notFound flag
      // (supabase.functions.invoke treats non-2xx as errors)
      console.log('Product not found for barcode:', barcode);
      return new Response(
        JSON.stringify({ notFound: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const row = rows[0];

    return new Response(
      JSON.stringify({
        product_id: row.product_id,
        barcode: row.gtin ?? row.barcode ?? row.upc ?? '',
        product_name: row.product_name,
        category: row.category ?? null,
        brand_sku: row.brand_sku ?? null,
        brand_id: row.brand_id,
        brand_name: row.brand_name,
        logo_url: row.logo_url ?? null,
        parent_company_id: null,
        labor_score: row.score_labor ?? null,
        environment_score: row.score_environment ?? null,
        politics_score: row.score_politics ?? null,
        social_score: row.score_social ?? null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-product-by-barcode:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
