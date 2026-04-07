import { createClient } from 'npm:@supabase/supabase-js@2';
import { normalizeBrandLabel, capitalizeBrandName, stripCorporateSuffixes, brandNameToSlug } from '../_shared/brandNormalization.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CONFIDENCE_SCORES = {
  'verified_db': 100,
  'user_verified': 95,
  'barcodelookup': 92,
  'openfoodfacts': 90,
  'gs1': 85,
  'upcitemdb': 70,
  'user_submitted': 50,
};

const CACHE_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

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

    barcode = String(barcode).trim();
    if (/^\d{12}$/.test(barcode)) {
      barcode = '0' + barcode;
      console.log(`[Normalize] Padded UPC-A to EAN-13: ${barcode}`);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Tier 1: Check cache
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
          JSON.stringify({ product: cached, source: 'cache', confidence: cached.confidence_score || 100 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Tier 2: OpenFoodFacts
    const offBarcodesToTry = [barcode];
    if (/^0\d{12}$/.test(barcode)) offBarcodesToTry.push(barcode.slice(1));
    if (/^\d{12}$/.test(barcode)) offBarcodesToTry.push('0' + barcode);

    for (const offBarcode of offBarcodesToTry) {
      try {
        console.log(`[Tier 2] Trying OpenFoodFacts for ${offBarcode}`);
        const offResponse = await fetch(`https://world.openfoodfacts.org/api/v0/product/${offBarcode}.json`, {
          headers: { 'Accept': 'application/json' }
        });
        
        const contentType = offResponse.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          await offResponse.text();
          continue;
        }
        
        const offText = await offResponse.text();
        let offData;
        try { offData = JSON.parse(offText); } catch { continue; }
        
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
            metadata: { ingredients: product.ingredients_text, nutrition: product.nutriments }
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

    // Tier 2.5: Barcode Lookup API
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
              metadata: { description: item.description, manufacturer: item.manufacturer, ingredients: item.ingredients }
            });
            return new Response(
              JSON.stringify({ product: result, source: 'barcodelookup', confidence: CONFIDENCE_SCORES['barcodelookup'] }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else if (blResponse.status === 429) {
          console.warn('[Tier 2.5] Rate limited');
          await blResponse.text();
        } else {
          console.log(`[Tier 2.5] Returned ${blResponse.status}`);
          await blResponse.text();
        }
      } catch (error) {
        console.error('[Tier 2.5] Barcode Lookup API failed:', error);
      }
    }

    // Tier 3: UPCitemdb FREE
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
        const upcResponse = await fetch(`https://api.upcitemdb.com/prod/v1/lookup?upc=${upcBarcode}`, {
          headers: { 'Content-Type': 'application/json', 'user_key': upcApiKey }
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

    // Tier 4: Not found
    const manufacturerPrefix = barcode.substring(0, 3);
    console.log(`[Tier 4] Product not found for ${barcode}`);
    
    return new Response(
      JSON.stringify({ 
        ok: true, product: null, source: 'not_found', barcode,
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

// ─── Multi-strategy brand matching ───
// deno-lint-ignore no-explicit-any
async function findBrandMatch(supabase: any, rawBrandName: string): Promise<{ id: string; status: string; logo_url: string | null } | null> {
  const normalized = normalizeBrandLabel(rawBrandName);
  const displayName = capitalizeBrandName(normalized) || rawBrandName.trim();
  const stripped = stripCorporateSuffixes(normalized);
  const slug = brandNameToSlug(rawBrandName);

  console.log(`[Brand Match] raw="${rawBrandName}" normalized="${normalized}" stripped="${stripped}" slug="${slug}"`);

  // Strategy 1: Exact slug match
  const { data: slugMatch } = await supabase
    .from('brands')
    .select('id, status, logo_url')
    .eq('slug', slug)
    .maybeSingle();
  if (slugMatch) {
    console.log(`[Brand Match] ✓ Slug match: ${slug}`);
    return slugMatch;
  }

  // Strategy 2: Case-insensitive name match (exact)
  const { data: exactMatch } = await supabase
    .from('brands')
    .select('id, status, logo_url')
    .ilike('name', displayName)
    .limit(1)
    .maybeSingle();
  if (exactMatch) {
    console.log(`[Brand Match] ✓ Exact name match: ${displayName}`);
    return exactMatch;
  }

  // Strategy 3: Alias table match
  const { data: aliasMatch } = await supabase
    .from('brand_aliases')
    .select('canonical_brand_id, brands:canonical_brand_id(id, status, logo_url)')
    .ilike('external_name', rawBrandName.trim())
    .limit(1)
    .maybeSingle();
  if (aliasMatch?.brands) {
    console.log(`[Brand Match] ✓ Alias match: "${rawBrandName}" → brand ${aliasMatch.canonical_brand_id}`);
    return aliasMatch.brands as any;
  }

  // Strategy 4: Stripped suffix match — e.g. "The Kraft Heinz Company" matches "Kraft Heinz"
  if (stripped !== normalized) {
    const strippedDisplay = capitalizeBrandName(stripped);
    const { data: strippedMatch } = await supabase
      .from('brands')
      .select('id, status, logo_url')
      .ilike('name', strippedDisplay)
      .limit(1)
      .maybeSingle();
    if (strippedMatch) {
      console.log(`[Brand Match] ✓ Stripped suffix match: ${strippedDisplay}`);
      return strippedMatch;
    }
  }

  // Strategy 5: Contains match — "Kraft" matches a brand named "Kraft Heinz" or vice versa
  // Only for brand names with 4+ chars to avoid false positives
  if (stripped.length >= 4) {
    // Check if any existing brand name starts with our query
    const { data: containsMatch } = await supabase
      .from('brands')
      .select('id, status, logo_url, name')
      .ilike('name', `${capitalizeBrandName(stripped)}%`)
      .limit(5);
    
    if (containsMatch && containsMatch.length === 1) {
      console.log(`[Brand Match] ✓ Prefix match: "${stripped}" → "${containsMatch[0].name}"`);
      return containsMatch[0];
    }

    // Check if our name contains an existing brand
    // e.g. input "Kraft Mac & Cheese" should match brand "Kraft"
    const words = stripped.split(' ');
    if (words.length > 1) {
      // Try first word as brand (very common: "Kraft Mac & Cheese" → "Kraft")
      const firstWord = capitalizeBrandName(words[0]);
      if (words[0].length >= 4) {
        const { data: firstWordMatch } = await supabase
          .from('brands')
          .select('id, status, logo_url')
          .ilike('name', firstWord)
          .limit(1)
          .maybeSingle();
        if (firstWordMatch) {
          console.log(`[Brand Match] ✓ First-word match: "${firstWord}"`);
          return firstWordMatch;
        }
      }
    }
  }

  console.log(`[Brand Match] ✗ No match found for "${rawBrandName}"`);
  return null;
}

// deno-lint-ignore no-explicit-any
async function saveToCache(supabase: any, productData: any) {
  const expiresAt = new Date(Date.now() + CACHE_DURATION_MS);
  
  let brandId: string | null = null;
  if (productData.brand_name && productData.brand_name.trim()) {
    const rawBrandName = productData.brand_name.trim();

    // Multi-strategy brand matching
    const match = await findBrandMatch(supabase, rawBrandName);
    
    if (match) {
      brandId = match.id;
      
      // Auto-promote stub/building brands to active (don't touch ready brands)
      if (match.status === 'stub' || match.status === 'building') {
        console.log(`[saveToCache] Auto-promoting brand "${rawBrandName}" from "${match.status}" to "active"`);
        await supabase.from('brands').update({ status: 'active' }).eq('id', match.id);
      }
    } else {
      // Create brand as active immediately
      const normalized = normalizeBrandLabel(rawBrandName);
      const displayName = capitalizeBrandName(normalized) || rawBrandName.trim();
      const slug = brandNameToSlug(rawBrandName);

      const { data: newBrand, error: brandError } = await supabase
        .from('brands')
        .insert({
          name: displayName,
          slug,
          website: null,
          description: 'Brand information pending enrichment',
          status: 'active',
        })
        .select('id')
        .single();
      
      if (brandError) {
        // Slug collision — try with suffix
        if (brandError.code === '23505') {
          const { data: retryBrand } = await supabase
            .from('brands')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
          if (retryBrand) {
            brandId = retryBrand.id;
            console.log(`[saveToCache] Slug collision resolved — matched existing brand ${brandId}`);
          }
        } else {
          console.error('[saveToCache] Failed to create brand:', brandError);
        }
      } else if (newBrand) {
        brandId = newBrand.id;
        console.log(`[saveToCache] Created active brand: ${displayName} (${brandId})`);

        // Also create an alias so future lookups with the raw name hit this brand
        try {
          await supabase.from('brand_aliases').insert({
            canonical_brand_id: brandId,
            external_name: rawBrandName,
            source: productData.data_source || 'api_lookup',
          });
        } catch (e) {
          console.warn('[saveToCache] Alias creation skipped:', e);
        }
      }
    }
    
    // Queue enrichment + ensure baseline score
    if (brandId) {
      try {
        await supabase.from('brand_enrichment_queue').upsert({
          brand_id: brandId, task: 'full_enrichment', status: 'pending',
          next_run_at: new Date().toISOString(),
        }, { onConflict: 'brand_id,task' });
      } catch (e) { console.warn('[saveToCache] Enrichment queue failed:', e); }

      // Ensure brand_scores row exists — but NEVER overwrite existing real scores
      try {
        const { data: existingScore } = await supabase
          .from('brand_scores')
          .select('brand_id')
          .eq('brand_id', brandId)
          .maybeSingle();
        
        if (!existingScore) {
          await supabase.from('brand_scores').insert({
            brand_id: brandId,
            score: 50, score_labor: 50, score_environment: 50,
            score_politics: 50, score_social: 50,
            last_updated: new Date().toISOString(),
          });
          console.log(`[saveToCache] Created baseline score for brand ${brandId}`);
        } else {
          console.log(`[saveToCache] Score already exists for brand ${brandId}, skipping`);
        }
      } catch (e) { console.warn('[saveToCache] Score init failed:', e); }
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
    }, { onConflict: 'barcode' })
    .select('*, brands(id, name, logo_url)')
    .single();

  if (error) {
    if (error.code === '23505') {
      console.log('[saveToCache] Duplicate detected, fetching existing');
      const { data: existing } = await supabase
        .from('products')
        .select('*, brands(id, name, logo_url)')
        .eq('barcode', productData.barcode)
        .limit(1)
        .maybeSingle();
      if (existing) return existing;

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
