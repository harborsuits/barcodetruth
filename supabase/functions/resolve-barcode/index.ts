import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Brand normalization overrides
const BRAND_OVERRIDES: Record<string, string> = {
  "campbell's": "campbells",
  "campbells": "campbells",
  "procter & gamble": "procter_gamble",
  "p&g": "procter_gamble",
  "coca cola": "coca-cola",
  "coke": "coca-cola",
};

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

    // 2. Fallback: OpenFoodFacts API
    console.log(`[${barcode}] Checking OpenFoodFacts...`);
    
    const offUrl = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;
    const offRes = await fetch(offUrl);
    
    if (offRes.ok) {
      const offData = await offRes.json();
      
      if (offData.status === 1 && offData.product) {
        const brands = offData.product.brands || offData.product.brands_tags?.[0] || '';
        const normalized = brands.split(',')[0].trim().toLowerCase();
        const productName = offData.product.product_name || offData.product.product_name_en || 'Unknown Product';
        
        // Apply brand overrides
        const mappedBrand = BRAND_OVERRIDES[normalized] || normalized;
        
        console.log(`[${barcode}] Found on OpenFoodFacts: ${productName} -> ${mappedBrand}`);
        
        // Try to find the brand in our database
        const { data: brandMatch } = await supabase
          .from('brands')
          .select('*')
          .ilike('id', mappedBrand)
          .maybeSingle();
        
        // Cache the result (24h TTL implied by usage pattern)
        if (brandMatch) {
          const { error: insertError } = await supabase
            .from('products')
            .insert({
              name: productName,
              barcode,
              brand_id: brandMatch.id,
            });
          
          if (!insertError) {
            return new Response(
              JSON.stringify({
                success: true,
                product: { name: productName, barcode },
                brand: brandMatch,
                source: 'openfoodfacts',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
        
        // Brand found but not in our DB - suggest mapping
        return new Response(
          JSON.stringify({
            success: false,
            product: { name: productName, barcode },
            brand_guess: mappedBrand,
            error: 'Brand not in database',
            message: 'Product found but brand needs to be added to our database.',
            action: 'report_mapping',
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log(`[${barcode}] Not found on OpenFoodFacts`);
    
    // Cache 404s (1h TTL - future optimization)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Product not found',
        message: 'Barcode not found in any database.',
        action: 'report_mapping',
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
