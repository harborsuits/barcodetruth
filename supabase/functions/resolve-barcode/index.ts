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

// Simple rate limiter
const rateLimitBuckets = new Map<string, { tokens: number; ts: number }>();
function checkRateLimit(ip: string, maxTokens = 10, perMs = 60_000): boolean {
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

// Extract GS1 company prefix (6-10 digits for longest match)
function extractGS1Prefix(ean13: string): string | null {
  if (!/^\d{13}$/.test(ean13)) return null;
  
  // Try 7-digit prefix first (most common for US companies)
  const prefix7 = ean13.slice(0, 7);
  // Also support 6-digit for fallback
  const prefix6 = ean13.slice(0, 6);
  
  // Return longest available (we'll query both in order)
  return prefix7;
}

// Cooldown cache for recent "not found" barcodes (60s TTL)
const notFoundCache = new Map<string, number>();
function isRecentNotFound(barcode: string): boolean {
  const cached = notFoundCache.get(barcode);
  if (!cached) return false;
  if (Date.now() - cached > 60_000) {
    notFoundCache.delete(barcode);
    return false;
  }
  return true;
}
function cacheNotFound(barcode: string): void {
  notFoundCache.set(barcode, Date.now());
  // Cleanup old entries periodically
  if (notFoundCache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of notFoundCache.entries()) {
      if (now - v > 60_000) notFoundCache.delete(k);
    }
  }
}

interface BarcodeRequest {
  barcode: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting (10 per minute)
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
  if (!checkRateLimit(clientIp, 10, 60_000)) {
    console.log(JSON.stringify({ level: "warn", fn: "resolve-barcode", ip: clientIp, msg: "rate_limited" }));
    return new Response(
      JSON.stringify({ error: 'RATE_LIMITED', message: 'Too many barcode scans. Please wait a minute.' }),
      { 
        status: 429, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' }
      }
    );
  }

  const t0 = performance.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      throw new Error('supabaseKey is required.');
    }
    const supabase = createClient(supabaseUrl, serviceKey);

    const { barcode } = await req.json() as BarcodeRequest;

    if (!barcode || typeof barcode !== 'string' || barcode.length < 8 || barcode.length > 14) {
      return new Response(
        JSON.stringify({ error: 'Invalid barcode format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize barcode (UPC-A → EAN-13)
    const normalizedBarcode = barcode.length === 12 && /^\d+$/.test(barcode) ? '0' + barcode : barcode;

    console.log(JSON.stringify({ level: "info", fn: "resolve-barcode", barcode: normalizedBarcode, ip: clientIp }));

    // Check cooldown cache for recent "not found"
    if (isRecentNotFound(normalizedBarcode)) {
      const dur = Math.round(performance.now() - t0);
      console.log(JSON.stringify({ 
        level: "info", 
        fn: "resolve-barcode", 
        barcode: normalizedBarcode, 
        source: "cooldown_cache",
        dur_ms: dur,
        ok: false
      }));
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Product not found',
          message: 'Barcode not found in any database.',
          action: 'report_mapping',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Check local cache (products table) - use normalized barcode
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
      .or(`barcode.eq.${normalizedBarcode},barcode.eq.${barcode}`)
      .maybeSingle();

    if (product && product.brands) {
      const dur = Math.round(performance.now() - t0);
      console.log(JSON.stringify({ 
        level: "info", 
        fn: "resolve-barcode", 
        barcode: normalizedBarcode, 
        source: "cache",
        brand_id: product.brands.id,
        dur_ms: dur,
        ok: true
      }));
      
      return new Response(
        JSON.stringify({
          success: true,
          brand_id: product.brands.id,
          brand_name: product.brands.name,
          upc: normalizedBarcode,
          product_name: product.name,
          product: {
            id: product.id,
            name: product.name,
            barcode: normalizedBarcode,
          },
          brand: product.brands,
          source: 'cache',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Fallback: OpenFoodFacts API
    console.log(`[${normalizedBarcode}] Checking OpenFoodFacts...`);
    
    const offUrl = `https://world.openfoodfacts.org/api/v0/product/${normalizedBarcode}.json`;
    const offRes = await fetch(offUrl, {
      headers: {
        'User-Agent': 'ShopSignals/1.0 (contact@shopsignals.app)',
      }
    });
    
    if (offRes.ok) {
      const offData = await offRes.json();
      
      if (offData.status === 1 && offData.product) {
        const brands = offData.product.brands || offData.product.brands_tags?.[0] || '';
        const normalized = brands.split(',')[0].trim().toLowerCase();
        const productName = offData.product.product_name || offData.product.product_name_en || 'Unknown Product';
        
        // Apply brand overrides
        const mappedBrand = BRAND_OVERRIDES[normalized] || normalized;
        
        console.log(`[${normalizedBarcode}] Found on OpenFoodFacts: ${productName} -> ${mappedBrand}`);
        
        // Try to find the brand in our database
          const { data: brandMatch } = await supabase
            .from('brands')
            .select('id, name')
            .ilike('name', mappedBrand)
            .maybeSingle();
          
          let brandId: string | null = brandMatch?.id ?? null;
          let brandName: string | null = brandMatch?.name ?? null;
          
          if (!brandId) {
            const { data: newBrand, error: brandInsertError } = await supabase
              .from('brands')
              .insert({ name: mappedBrand })
              .select('id, name')
              .single();
            
            if (brandInsertError || !newBrand) {
              const dur = Math.round(performance.now() - t0);
              console.log(JSON.stringify({ 
                level: "info", 
                fn: "resolve-barcode", 
                barcode: normalizedBarcode,
                source: "openfoodfacts",
                brand_guess: mappedBrand,
                dur_ms: dur,
                ok: false
              }));
              
              return new Response(
                JSON.stringify({
                  success: false,
                  product: { name: productName, barcode: normalizedBarcode },
                  brand_guess: mappedBrand,
                  error: 'Brand creation failed',
                  message: 'Product found but brand could not be created.',
                  action: 'report_mapping',
                }),
                { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            brandId = newBrand.id;
            brandName = newBrand.name;
          }
          
          const { error: insertError } = await supabase
            .from('products')
            .insert({
              name: productName,
              barcode: normalizedBarcode,
              brand_id: brandId!,
            });
          
          if (!insertError) {
            const dur = Math.round(performance.now() - t0);
            console.log(JSON.stringify({ 
              level: "info", 
              fn: "resolve-barcode", 
              barcode: normalizedBarcode,
              source: "openfoodfacts",
              brand_id: brandId,
              dur_ms: dur,
              ok: true
            }));
            
            return new Response(
              JSON.stringify({
                success: true,
                brand_id: brandId,
                brand_name: brandName,
                upc: normalizedBarcode,
                product_name: productName,
                product: { name: productName, barcode: normalizedBarcode },
                brand: { id: brandId, name: brandName },
                source: 'openfoodfacts',
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        
        // Brand found but not in our DB - suggest mapping
        const dur = Math.round(performance.now() - t0);
        console.log(JSON.stringify({ 
          level: "info", 
          fn: "resolve-barcode", 
          barcode: normalizedBarcode,
          source: "openfoodfacts",
          brand_guess: mappedBrand,
          dur_ms: dur,
          ok: false
        }));
        
        return new Response(
          JSON.stringify({
            success: false,
            product: { name: productName, barcode: normalizedBarcode },
            brand_guess: mappedBrand,
            error: 'Brand not in database',
            message: 'Product found but brand needs to be added to our database.',
            action: 'report_mapping',
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log(`[${normalizedBarcode}] Not found on OpenFoodFacts, trying GS1 fallback...`);
    
    // 3. GS1 prefix fallback (Phase 1)
    const gs1Prefix = extractGS1Prefix(normalizedBarcode);
    if (gs1Prefix) {
      console.log(`[${normalizedBarcode}] Trying GS1 prefix: ${gs1Prefix}`);
      
      const { data: prefixMatch } = await supabase
        .from('gs1_prefix_registry')
        .select('company_name, country')
        .eq('prefix', gs1Prefix)
        .maybeSingle();
      
      if (prefixMatch) {
        console.log(`[${normalizedBarcode}] GS1 match: ${prefixMatch.company_name}`);
        
        // Try to map company name to brand via aliases
        const { data: aliasMatches } = await supabase
          .from('brand_aliases')
          .select(`
            confidence,
            canonical_brand_id,
            brands!brand_aliases_canonical_brand_id_fkey (
              id,
              name,
              parent_company
            )
          `)
          .ilike('external_name', prefixMatch.company_name)
          .order('confidence', { ascending: false })
          .limit(1);
        
        const aliasMatch = aliasMatches?.[0];
        const brandInfo = Array.isArray(aliasMatch?.brands) 
          ? aliasMatch.brands[0] 
          : aliasMatch?.brands;
        
        const ownerGuess = {
          company_name: prefixMatch.company_name,
          brand_id: (brandInfo as any)?.id || null,
          brand_name: (brandInfo as any)?.name || null,
          confidence: aliasMatch ? Math.min(aliasMatch.confidence, 75) : 50,
          method: 'gs1_prefix',
          country: prefixMatch.country
        };
        
        const dur = Math.round(performance.now() - t0);
        console.log(JSON.stringify({ 
          level: "info", 
          fn: "resolve-barcode", 
          barcode: normalizedBarcode,
          source: "gs1_fallback",
          company: prefixMatch.company_name,
          brand_id: ownerGuess.brand_id,
          confidence: ownerGuess.confidence,
          dur_ms: dur,
          ok: false
        }));
        
        return new Response(
          JSON.stringify({
            success: false,
            owner_guess: ownerGuess,
            barcode: normalizedBarcode,
            action: 'confirm_or_submit',
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    const dur = Math.round(performance.now() - t0);
    console.log(JSON.stringify({ 
      level: "info", 
      fn: "resolve-barcode", 
      barcode: normalizedBarcode,
      source: "none",
      dur_ms: dur,
      ok: false
    }));
    
    // Cache recent "not found" to avoid hammering APIs
    cacheNotFound(normalizedBarcode);
    
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
    const dur = Math.round(performance.now() - t0);
    console.error(JSON.stringify({ 
      level: "error", 
      fn: "resolve-barcode", 
      msg: String(error instanceof Error ? error.message : error),
      dur_ms: dur
    }));
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
