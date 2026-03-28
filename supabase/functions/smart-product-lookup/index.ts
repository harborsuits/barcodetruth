import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeBrandLabel, capitalizeBrandName } from '../_shared/brandNormalization.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Confidence scoring
const CONFIDENCE_SCORES = {
  'verified_db': 100,
  'user_verified': 95,
  'barcodelookup': 92,
  'openfoodfacts': 90,
  'gs1': 85,
  'upcitemdb': 70,
  'user_submitted': 50,
};

const CACHE_DURATION_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let { barcode } = await req.json();
    
    if (!barcode) {
      return new Response(
        JSON.stringify({ error: 'Barcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize: pad 12-digit UPC-A to 13-digit EAN-13
    barcode = String(barcode).trim();
    if (/^\d{12}$/.test(barcode)) {
      barcode = '0' + barcode;
      console.log(`[Normalize] Padded UPC-A to EAN-13: ${barcode}`);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Tier 1: Check cache — try both original and padded/unpadded variants
    const barcodesToCheck = [barcode];
    if (/^\d{12}$/.test(barcode)) barcodesToCheck.push('0' + barcode);
    else if (/^0\d{12}$/.test(barcode)) barcodesToCheck.push(barcode.slice(1));

    for (const bc of barcodesToCheck) {
      const { data: cached } = await supabase
        .from('products')
        .select('*, brands(id, name, logo_url)')
        .eq('barcode', bc)
        .limit(1)
        .maybeSingle();

      if (cached) {
        console.log(`[Tier 1] Cache hit for ${bc}`);
        return new Response(
          JSON.stringify({ 
            product: cached, 
            source: 'cache',
            confidence: cached.confidence_score || 100 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Tier 2: OpenFoodFacts (FREE) — try both original and padded barcode
    const offBarcodesToTry = [barcode];
    // Also try the unpadded 12-digit version (OFF stores some products under UPC-A)
    if (/^0\d{12}$/.test(barcode)) offBarcodesToTry.push(barcode.slice(1));
    // Also try the padded version if we started with 12 digits
    if (/^\d{12}$/.test(barcode)) offBarcodesToTry.push('0' + barcode);

    for (const offBarcode of offBarcodesToTry) {
      try {
        console.log(`[Tier 2] Trying OpenFoodFacts for ${offBarcode}`);
        const offResponse = await fetch(`https://world.openfoodfacts.org/api/v0/product/${offBarcode}.json`, {
          headers: { 'Accept': 'application/json' }
        });
        
        const contentType = offResponse.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          console.log(`[Tier 2] OpenFoodFacts returned non-JSON: ${contentType}`);
          await offResponse.text(); // consume body
          continue;
        }
        
        const offText = await offResponse.text();
        let offData;
        try {
          offData = JSON.parse(offText);
        } catch {
          console.error('[Tier 2] OpenFoodFacts JSON parse failed');
          continue;
        }
        
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
        console.error(`[Tier 2] OpenFoodFacts failed for ${offBarcode}:`, error);
      }
    }

    // Tier 2.5: Barcode Lookup API (excellent US grocery coverage)
    const blApiKey = Deno.env.get('BARCODELOOKUP_API_KEY');
    if (blApiKey) {
      try {
        const blBarcode = /^0\d{12}$/.test(barcode) ? barcode.slice(1) : barcode;
        console.log(`[Tier 2.5] Trying Barcode Lookup API for ${blBarcode}`);
        const blResponse = await fetch(
          `https://api.barcodelookup.com/v3/products?barcode=${blBarcode}&formatted=y&key=${blApiKey}`
        );
        
        if (blResponse.status === 200) {
          const blData = await blResponse.json();
          if (blData.products && blData.products.length > 0) {
            const item = blData.products[0];
            const result = await saveToCache(supabase, {
              barcode,
              name: item.title || item.product_name,
              brand_name: item.brand,
              category: item.category,
              image_url: item.images?.[0],
              data_source: 'barcodelookup',
              confidence_score: CONFIDENCE_SCORES['barcodelookup'],
              metadata: { 
                description: item.description,
                manufacturer: item.manufacturer,
                ingredients: item.ingredients,
              }
            });
            
            return new Response(
              JSON.stringify({ product: result, source: 'barcodelookup', confidence: CONFIDENCE_SCORES['barcodelookup'] }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          } else {
            console.log('[Tier 2.5] Barcode Lookup API returned empty products array');
          }
        } else if (blResponse.status === 429) {
          console.warn('[Tier 2.5] Barcode Lookup API rate limited — skipping to next tier');
          await blResponse.text();
        } else if (blResponse.status === 404) {
          console.log('[Tier 2.5] Barcode Lookup API: product not found');
          await blResponse.text();
        } else {
          console.log(`[Tier 2.5] Barcode Lookup API returned ${blResponse.status}`);
          await blResponse.text();
        }
      } catch (error) {
        console.error('[Tier 2.5] Barcode Lookup API failed:', error);
      }
    }

    // Tier 3: UPCitemdb FREE trial (no key needed, rate-limited)
    try {
      const upcBarcode = /^0\d{12}$/.test(barcode) ? barcode.slice(1) : barcode;
      console.log(`[Tier 3] Trying UPCitemdb trial for ${upcBarcode}`);
      const upcResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upcBarcode}`);
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
          metadata: { description: item.description }
        });
        
        return new Response(
          JSON.stringify({ product: result, source: 'upcitemdb', confidence: CONFIDENCE_SCORES['upcitemdb'] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch (error) {
      console.error('[Tier 3] UPCitemdb trial failed:', error);
    }

    // Tier 3.5: UPCitemdb PAID
    const upcApiKey = Deno.env.get('UPCITEMDB_API_KEY');
    if (upcApiKey) {
      try {
        const upcBarcode = /^0\d{12}$/.test(barcode) ? barcode.slice(1) : barcode;
        console.log(`[Tier 3.5] Trying UPCitemdb paid for ${upcBarcode}`);
        const upcResponse = await fetch(`https://api.upcitemdb.com/prod/v1/lookup?upc=${upcBarcode}`, {
          headers: { 
            'Content-Type': 'application/json',
            'user_key': upcApiKey,
          }
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
            metadata: { description: item.description }
          });
          
          return new Response(
            JSON.stringify({ product: result, source: 'upcitemdb', confidence: CONFIDENCE_SCORES['upcitemdb'] }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch (error) {
        console.error('[Tier 3.5] UPCitemdb paid failed:', error);
      }
    }

    // Tier 4: Not found - return manufacturer info from barcode
    // IMPORTANT: Return 200 so supabase.functions.invoke doesn't treat as error
    const manufacturerPrefix = barcode.substring(0, 3);
    
    console.log(`[Tier 4] Product not found for ${barcode}, manufacturer prefix: ${manufacturerPrefix}`);
    
    return new Response(
      JSON.stringify({ 
        ok: true,
        product: null,
        source: 'not_found',
        barcode,
        manufacturer_prefix: manufacturerPrefix,
        requires_submission: true,
        message: 'Product not found in any data source'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Smart lookup error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
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
      .limit(1)
      .maybeSingle();
    
    if (existingBrand) {
      brandId = existingBrand.id;
    } else {
      // Create brand stub with explicit status
      const { data: newBrand, error: brandError } = await supabase
        .from('brands')
        .insert({
          name: normalizedName,
          website: null,
          description: 'Brand information pending enrichment',
          status: 'stub',
        })
        .select('id')
        .single();
      
      if (brandError) {
        console.error('[smart-product-lookup] Failed to create brand:', brandError);
      } else if (newBrand) {
        brandId = newBrand.id;
        console.log(`[smart-product-lookup] Created brand stub: ${normalizedName} (${brandId})`);
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
    .select('*, brands(id, name, logo_url)')
    .single();

  if (error) {
    // If duplicate key (product already exists with normalized barcode), fetch existing
    if (error.code === '23505') {
      console.log('[smart-product-lookup] Duplicate detected, fetching existing product');
      const { data: existing } = await supabase
        .from('products')
        .select('*, brands(id, name, logo_url)')
        .eq('barcode', productData.barcode)
        .limit(1)
        .maybeSingle();
      
      if (existing) return existing;
      
      // Try with padded barcode
      const padded = '0' + productData.barcode;
      const { data: paddedExisting } = await supabase
        .from('products')
        .select('*, brands(id, name, logo_url)')
        .eq('barcode', padded)
        .limit(1)
        .maybeSingle();
      
      if (paddedExisting) return paddedExisting;
    }
    console.error('Cache save error:', error);
    throw error;
  }

  return product;
}
