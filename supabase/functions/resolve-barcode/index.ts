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

// Helper: Find ultimate parent by following the chain
async function findUltimateParent(
  supabase: any,
  companyId: string,
  maxDepth = 5
): Promise<{ id: string; name: string } | null> {
  let currentId = companyId;
  let currentName = '';
  let depth = 0;
  const visited = new Set<string>([companyId]);
  
  while (depth < maxDepth) {
    // Find parent of current company
    const { data: ownership } = await supabase
      .from('company_ownership')
      .select(`
        parent_company_id,
        companies!company_ownership_parent_company_id_fkey (
          id,
          name
        )
      `)
      .eq('child_company_id', currentId)
      .maybeSingle();
    
    if (!ownership?.parent_company_id) {
      // No parent found - this IS the ultimate parent
      const { data: company } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', currentId)
        .single();
      return company || null;
    }
    
    const parentCompany = Array.isArray(ownership.companies)
      ? ownership.companies[0]
      : ownership.companies;
    
    if (!parentCompany || visited.has(parentCompany.id)) {
      // Loop detected or invalid data
      break;
    }
    
    currentId = parentCompany.id;
    currentName = parentCompany.name;
    visited.add(currentId);
    depth++;
  }
  
  return currentId ? { id: currentId, name: currentName } : null;
}

// Helper function to fetch brand logo from Clearbit
async function fetchBrandLogo(companyName: string): Promise<string | null> {
  try {
    // Try Clearbit Logo API (free tier)
    const domain = `${companyName.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`;
    const clearbitUrl = `https://logo.clearbit.com/${domain}`;
    
    // Test if logo exists (HEAD request to avoid downloading)
    const response = await fetch(clearbitUrl, { method: 'HEAD' });
    if (response.ok) {
      console.log('[fetchBrandLogo] Found logo via Clearbit:', clearbitUrl);
      return clearbitUrl;
    }
  } catch (e) {
    console.log('[fetchBrandLogo] Clearbit failed:', e);
  }
  
  return null;
}

// Helper function to resolve complete ownership chain
async function resolveOwnershipChain(
  supabase: any,
  brandName: string,
  parentCompanyHint: string,
  logoUrl?: string
): Promise<{ brand_id: string; company_id: string | null; company_name: string | null; ultimate_parent_id: string | null; ultimate_parent_name: string | null }> {
  
  console.log('[resolveOwnershipChain] START:', { brandName, parentCompanyHint, logoUrl });
  
  // Step 1: Find or create the BRAND
  let { data: brand } = await supabase
    .from('brands')
    .select('id, name, logo_url')
    .ilike('name', brandName)
    .maybeSingle();
  
  if (!brand) {
    const brandData: any = { name: brandName };
    if (logoUrl) {
      brandData.logo_url = logoUrl;
      brandData.logo_source = 'openfoodfacts';
    }
    
    const { data: newBrand } = await supabase
      .from('brands')
      .insert(brandData)
      .select('id, name, logo_url')
      .single();
    brand = newBrand;
  } else if (!brand.logo_url && logoUrl) {
    // Update existing brand with logo if it doesn't have one
    await supabase
      .from('brands')
      .update({ 
        logo_url: logoUrl,
        logo_source: 'openfoodfacts'
      })
      .eq('id', brand.id);
    brand.logo_url = logoUrl;
  }
  
  console.log('[resolveOwnershipChain] Brand result:', brand);
  
  if (!brand) {
    return { 
      brand_id: '', 
      company_id: null, 
      company_name: null,
      ultimate_parent_id: null,
      ultimate_parent_name: null
    };
  }
  
  // Step 2: Find or create the PARENT COMPANY if hint provided
  let companyId: string | null = null;
  let companyName: string | null = null;
  let ultimateParentId: string | null = null;
  let ultimateParentName: string | null = null;
  
  if (parentCompanyHint && parentCompanyHint.trim()) {
    console.log('[resolveOwnershipChain] Creating parent company:', parentCompanyHint);
    // Check if parent company exists in companies table
    let { data: parentCo } = await supabase
      .from('companies')
      .select('id, name')
      .ilike('name', parentCompanyHint)
      .maybeSingle();
    
    if (!parentCo) {
      // Create the parent company
      const { data: newParent } = await supabase
        .from('companies')
        .insert({ name: parentCompanyHint })
        .select('id, name')
        .single();
      parentCo = newParent;
      
      // Try to fetch and store company logo from Clearbit
      if (parentCo) {
        const companyLogo = await fetchBrandLogo(parentCompanyHint);
        if (companyLogo) {
          await supabase
            .from('companies')
            .update({ logo_url: companyLogo })
            .eq('id', parentCo.id);
          console.log('[resolveOwnershipChain] Added company logo:', companyLogo);
        }
      }
    }
    
    if (parentCo) {
      companyId = parentCo.id;
      companyName = parentCo.name;
      
      // Link brand → parent company in company_ownership table
      const { data: linkData, error: linkError } = await supabase
        .from('company_ownership')
        .upsert(
          {
            child_brand_id: brand.id,
            parent_company_id: parentCo.id,
            parent_name: parentCo.name,
            relationship: 'subsidiary',
            source: 'openfoodfacts',
            confidence: 0.7,
          },
          {
            onConflict: 'child_brand_id',
            ignoreDuplicates: false,
          }
        )
        .select();

      if (linkError) {
        console.error('[resolveOwnershipChain] ERROR creating link (upsert):', linkError);
        const { error: insertError } = await supabase
          .from('company_ownership')
          .insert({
            child_brand_id: brand.id,
            parent_company_id: parentCo.id,
            parent_name: parentCo.name,
            relationship: 'subsidiary',
            source: 'openfoodfacts',
            confidence: 0.7,
          });
        if (insertError) {
          console.error('[resolveOwnershipChain] ERROR creating link (insert):', insertError);
        } else {
          console.log('[resolveOwnershipChain] Created ownership link (via insert)');
        }
      } else {
        console.log('[resolveOwnershipChain] Created ownership link (via upsert):', linkData);
      }
      
      console.log('[resolveOwnershipChain] Created ownership link');
      // Step 3: Find the ULTIMATE PARENT (recursive lookup)
      const ultimateParent = await findUltimateParent(supabase, parentCo.id);
      
      if (ultimateParent && ultimateParent.id !== parentCo.id) {
        // There's a higher-level parent - link parent → ultimate parent
        const { data: parentLinkData, error: parentLinkError } = await supabase
          .from('company_ownership')
          .upsert(
            {
              child_company_id: parentCo.id,
              parent_company_id: ultimateParent.id,
              parent_name: ultimateParent.name,
              relationship: 'subsidiary',
              source: 'corporate_data',
              confidence: 0.8,
            },
            {
              onConflict: 'child_company_id',
              ignoreDuplicates: false,
            }
          )
          .select();

        if (parentLinkError) {
          console.error('[resolveOwnershipChain] ERROR creating parent→ultimate link (upsert):', parentLinkError);
          const { error: parentInsertError } = await supabase
            .from('company_ownership')
            .insert({
              child_company_id: parentCo.id,
              parent_company_id: ultimateParent.id,
              parent_name: ultimateParent.name,
              relationship: 'subsidiary',
              source: 'corporate_data',
              confidence: 0.8,
            });
          if (parentInsertError) {
            console.error('[resolveOwnershipChain] ERROR creating parent→ultimate link (insert):', parentInsertError);
          } else {
            console.log('[resolveOwnershipChain] Created parent→ultimate link (via insert)');
          }
        } else {
          console.log('[resolveOwnershipChain] Created parent→ultimate link (via upsert):', parentLinkData);
        }
        
        ultimateParentId = ultimateParent.id;
        ultimateParentName = ultimateParent.name;
      } else if (ultimateParent) {
        // Parent IS the ultimate parent
        ultimateParentId = ultimateParent.id;
        ultimateParentName = ultimateParent.name;
      }
    }
    console.log('[resolveOwnershipChain] Ultimate parent:', { ultimateParentId, ultimateParentName });
  }
  
  console.log('[resolveOwnershipChain] DONE:', { brand_id: brand.id, company_id: companyId, ultimate_parent_id: ultimateParentId });
  return {
    brand_id: brand.id,
    company_id: companyId,
    company_name: companyName,
    ultimate_parent_id: ultimateParentId,
    ultimate_parent_name: ultimateParentName
  };
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
      // Find parent company
      const { data: ownership } = await supabase
        .from('company_ownership')
        .select(`
          parent_company_id,
          companies!company_ownership_parent_company_id_fkey (
            id,
            name
          )
        `)
        .eq('child_brand_id', product.brands.id)
        .maybeSingle();
      
      const companyInfo = Array.isArray(ownership?.companies) 
        ? ownership.companies[0] 
        : ownership?.companies;
      
      // If no ownership exists, try to build it retroactively
      if (!ownership || !companyInfo) {
        console.log(`[${normalizedBarcode}] No ownership found for brand ${product.brands.name}, building chain...`);
        
        // Try to get parent company hint from brand.parent_company field
        const parentHint = product.brands.parent_company || '';
        
        if (parentHint) {
          try {
            const ownershipResult = await resolveOwnershipChain(
              supabase,
              product.brands.name,
              parentHint
            );
            
            console.log(`[${normalizedBarcode}] Ownership chain built retroactively:`, ownershipResult);
            
            // Update companyInfo with newly created ownership
            const { data: newOwnership } = await supabase
              .from('company_ownership')
              .select(`
                parent_company_id,
                companies!company_ownership_parent_company_id_fkey (
                  id,
                  name
                )
              `)
              .eq('child_brand_id', product.brands.id)
              .maybeSingle();
            
            if (newOwnership) {
              const updatedCompanyInfo = Array.isArray(newOwnership.companies)
                ? newOwnership.companies[0]
                : newOwnership.companies;
              
              const dur = Math.round(performance.now() - t0);
              console.log(JSON.stringify({ 
                level: "info", 
                fn: "resolve-barcode", 
                barcode: normalizedBarcode, 
                source: "cache_enriched",
                brand_id: product.brands.id,
                company_id: updatedCompanyInfo?.id,
                dur_ms: dur,
                ok: true
              }));
              
              return new Response(
                JSON.stringify({
                  success: true,
                  brand_id: product.brands.id,
                  brand_name: product.brands.name,
                  company_id: updatedCompanyInfo?.id || null,
                  company_name: updatedCompanyInfo?.name || null,
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
          } catch (err) {
            console.error(`[${normalizedBarcode}] Failed to build ownership chain:`, err);
            // Continue with normal flow without ownership
          }
        }
      }
      
      const dur = Math.round(performance.now() - t0);
      console.log(JSON.stringify({ 
        level: "info", 
        fn: "resolve-barcode", 
        barcode: normalizedBarcode, 
        source: "cache",
        brand_id: product.brands.id,
        company_id: companyInfo?.id,
        dur_ms: dur,
        ok: true
      }));
      
      return new Response(
        JSON.stringify({
          success: true,
          brand_id: product.brands.id,
          brand_name: product.brands.name,
          company_id: companyInfo?.id || null,
          company_name: companyInfo?.name || null,
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
      console.log('[resolve-barcode] OpenFoodFacts response:', {
        barcode: normalizedBarcode,
        product_name: offData.product?.product_name,
        brands: offData.product?.brands,
        owner: offData.product?.owner,
        manufacturer: offData.product?.manufacturer,
        manufacturing_places: offData.product?.manufacturing_places,
        origins: offData.product?.origins,
        brands_tags: offData.product?.brands_tags,
      });
      
        if (offData.status === 1 && offData.product) {
        const product = offData.product;
        
        // Extract product images
        const productImage = 
          product.image_url ||
          product.image_front_url ||
          product.image_front_small_url ||
          '';
        
        // Extract brand logo
        const brandLogo = 
          product.brand_logo_url ||
          product.brand_owner_logo_url ||
          '';
        
        console.log('[resolve-barcode] Images:', { productImage, brandLogo });
        
        // Extract ALL relevant fields for complete data
        const productName = product.product_name || product.product_name_en || 'Unknown Product';
        const brandRaw = product.brands || product.brands_tags?.[0] || '';
        const brandName = brandRaw.split(',')[0].trim().toLowerCase();
        
        // Try multiple sources for parent company
        const owner = product.owner || product.owner_imported || '';
        const manufacturer = product.manufacturer || product.manufacturing_places || '';
        const origins = product.origins || '';
        const brandTag = (product.brands_tags?.[0] || '').replace(/-/g, ' ');
        
        // Determine parent company with priority order
        const parentCompany = 
          owner ||  // Best: direct owner field
          brandTag ||  // Second: brand tag (often more accurate than brands text)
          manufacturer.split(',')[0]?.trim() ||  // Third: first manufacturer
          origins.split(',')[0]?.trim() ||  // Fourth: origins
          '';
        console.log('[resolve-barcode] Extracted parent company:', {
          parentCompany,
          owner,
          brandTag,
          manufacturer,
        });
        
        // Apply brand overrides
        const mappedBrand = BRAND_OVERRIDES[brandName] || brandName;
        
        console.log(`[${normalizedBarcode}] Found on OpenFoodFacts:`, {
          product: productName,
          brand: mappedBrand,
          owner,
          manufacturer,
          parentCompany,
          brandTag
        });
        
        // Use ownership chain resolver with logo
        console.log('[resolve-barcode] About to call resolveOwnershipChain:', {
          brandName: mappedBrand,
          parentCompanyHint: parentCompany,
          brandLogo,
        });
        const ownershipResult = await resolveOwnershipChain(
          supabase,
          mappedBrand,
          parentCompany,
          brandLogo || undefined
        );
        console.log('[resolve-barcode] resolveOwnershipChain result:', ownershipResult);
        
        if (!ownershipResult.brand_id) {
          const dur = Math.round(performance.now() - t0);
          console.log(JSON.stringify({ 
            level: "error", 
            fn: "resolve-barcode", 
            barcode: normalizedBarcode,
            msg: "Failed to create brand",
            dur_ms: dur
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
          
          // Insert product with resolved brand and image
          const { error: insertError } = await supabase
            .from('products')
            .insert({
              name: productName,
              barcode: normalizedBarcode,
              brand_id: ownershipResult.brand_id,
              image_url: productImage || null,
              source: 'openfoodfacts',
            });
          
          if (!insertError) {
            const dur = Math.round(performance.now() - t0);
            console.log(JSON.stringify({ 
              level: "info", 
              fn: "resolve-barcode", 
              barcode: normalizedBarcode,
              source: "openfoodfacts",
              brand_id: ownershipResult.brand_id,
              company_id: ownershipResult.company_id,
              company_name: ownershipResult.company_name,
              dur_ms: dur,
              ok: true
            }));
            
            return new Response(
              JSON.stringify({
                success: true,
                brand_id: ownershipResult.brand_id,
                brand_name: mappedBrand,
                company_id: ownershipResult.company_id,
                company_name: ownershipResult.company_name,
                upc: normalizedBarcode,
                product_name: productName,
                product: { name: productName, barcode: normalizedBarcode },
                brand: { id: ownershipResult.brand_id, name: mappedBrand },
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
