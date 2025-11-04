import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Confidence scoring
const CONFIDENCE_SCORES = {
  'verified_db': 100,
  'user_verified': 95,
  'openfoodfacts': 90,
  'gs1': 85,
  'upcitemdb': 70,
  'user_submitted': 50,
};

const CACHE_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { barcode } = await req.json();
    
    if (!barcode) {
      return new Response(
        JSON.stringify({ error: 'Barcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Tier 1: Check cache
    const { data: cached } = await supabase
      .from('products')
      .select('*, brands!inner(id, name, logo_url)')
      .eq('barcode', barcode)
      .gte('cache_expires_at', new Date().toISOString())
      .single();

    if (cached) {
      console.log(`[Tier 1] Cache hit for ${barcode}`);
      return new Response(
        JSON.stringify({ 
          product: cached, 
          source: 'cache',
          confidence: cached.confidence_score || 100 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Tier 2: OpenFoodFacts (FREE)
    try {
      console.log(`[Tier 2] Trying OpenFoodFacts for ${barcode}`);
      const offResponse = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
      const offData = await offResponse.json();
      
      if (offData.status === 1 && offData.product) {
        const product = offData.product;
        const result = await saveToCache(supabase, {
          barcode,
          name: product.product_name || product.product_name_en,
          brand_name: product.brands,
          category: product.categories,
          image_url: product.image_url,
          data_source: 'openfoodfacts',
          confidence_score: CONFIDENCE_SCORES['openfoodfacts'],
          metadata: {
            ingredients: product.ingredients_text,
            nutrition: product.nutriments,
          }
        });
        
        return new Response(
          JSON.stringify({ product: result, source: 'openfoodfacts', confidence: CONFIDENCE_SCORES['openfoodfacts'] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      console.error('[Tier 2] OpenFoodFacts failed:', error);
    }

    // Tier 3: UPCitemdb ($10/mo)
    const upcApiKey = Deno.env.get('UPCITEMDB_API_KEY');
    if (upcApiKey) {
      try {
        console.log(`[Tier 3] Trying UPCitemdb for ${barcode}`);
        const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {
          headers: { 'Authorization': `Bearer ${upcApiKey}` }
        });
        const upcData = await upcResponse.json();
        
        if (upcData.items && upcData.items.length > 0) {
          const item = upcData.items[0];
          const result = await saveToCache(supabase, {
            barcode,
            name: item.title,
            brand_name: item.brand,
            category: item.category,
            image_url: item.images?.[0],
            data_source: 'upcitemdb',
            confidence_score: CONFIDENCE_SCORES['upcitemdb'],
            metadata: {
              description: item.description,
            }
          });
          
          return new Response(
            JSON.stringify({ product: result, source: 'upcitemdb', confidence: CONFIDENCE_SCORES['upcitemdb'] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.error('[Tier 3] UPCitemdb failed:', error);
      }
    }

    // Tier 4: Not found - return manufacturer info from barcode
    const manufacturerPrefix = barcode.substring(0, 3);
    
    return new Response(
      JSON.stringify({ 
        product: null,
        source: 'not_found',
        barcode,
        manufacturer_prefix: manufacturerPrefix,
        requires_submission: true
      }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Smart lookup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function saveToCache(supabase: any, productData: any) {
  const expiresAt = new Date(Date.now() + CACHE_DURATION_MS);
  
  // First, ensure brand exists
  let brandId = null;
  if (productData.brand_name && productData.brand_name.trim()) {
    // Normalize brand name
    const normalizedName = productData.brand_name.trim();
    
    const { data: existingBrand } = await supabase
      .from('brands')
      .select('id')
      .ilike('name', normalizedName)
      .single();
    
    if (existingBrand) {
      brandId = existingBrand.id;
    } else {
      // Create brand with proper name (slug will be auto-generated by trigger)
      const { data: newBrand, error: brandError } = await supabase
        .from('brands')
        .insert({
          name: normalizedName,
          website: null,
          description: 'Brand information pending enrichment',
        })
        .select('id')
        .single();
      
      if (brandError) {
        console.error('[smart-product-lookup] Failed to create brand:', brandError);
      } else if (newBrand) {
        brandId = newBrand.id;
        console.log(`[smart-product-lookup] Created brand: ${normalizedName} (${brandId})`);
      }
    }
  }

  // Save product to cache
  const { data: product, error } = await supabase
    .from('products')
    .upsert({
      barcode: productData.barcode,
      name: productData.name,
      brand_id: brandId,
      category: productData.category,
      image_url: productData.image_url,
      data_source: productData.data_source,
      confidence_score: productData.confidence_score,
      cache_expires_at: expiresAt.toISOString(),
      metadata: productData.metadata || {},
    }, {
      onConflict: 'barcode',
    })
    .select('*, brands!inner(id, name, logo_url)')
    .single();

  if (error) {
    console.error('Cache save error:', error);
    throw error;
  }

  return product;
}
