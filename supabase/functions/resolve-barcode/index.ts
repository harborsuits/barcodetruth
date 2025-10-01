import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BarcodeRequest {
  barcode: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? ''
    );

    const { barcode } = await req.json() as BarcodeRequest;

    if (!barcode) {
      return new Response(
        JSON.stringify({ error: 'Barcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Check local cache (products table)
    const { data: product, error: productError } = await supabase
      .from('products')
      .select(`
        *,
        brands (
          id,
          name,
          parent_company
        )
      `)
      .eq('barcode', barcode)
      .maybeSingle();

    if (product && product.brands) {
      console.log('Barcode resolved from cache:', barcode);
      return new Response(
        JSON.stringify({
          success: true,
          product: {
            id: product.id,
            name: product.name,
            barcode: product.barcode,
          },
          brand: product.brands,
          source: 'cache',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fallback: External API (UPC database - mock for now)
    // In production, integrate with services like:
    // - https://world.openfoodfacts.org/api/v0/product/{barcode}.json
    // - https://api.upcdatabase.org/product/{barcode}
    
    console.log('Barcode not in cache, would call external API:', barcode);
    
    // For now, return not found - integration ready
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Product not found',
        message: 'Barcode not in database. External API integration pending.',
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Barcode resolution error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
