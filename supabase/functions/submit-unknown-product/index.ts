import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validate barcode format (UPC-A, EAN-13, UPC-E)
function isValidBarcode(barcode: string): boolean {
  const validLengths = [8, 12, 13];
  const isNumeric = /^\d+$/.test(barcode);
  return isNumeric && validLengths.includes(barcode.length);
}

// Generate a URL-safe slug from a name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

// Find an available slug with incrementing suffix (-2, -3, etc.)
// deno-lint-ignore no-explicit-any
async function findAvailableSlug(
  supabase: any,
  baseSlug: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  while (suffix <= 100) {
    const { data } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (!data) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  throw new Error('Too many slug collisions');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { barcode, product_name, brand_name, category } = await req.json();

    // Validate required fields
    if (!barcode || !isValidBarcode(barcode)) {
      return new Response(
        JSON.stringify({ error: 'Valid barcode is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!product_name || typeof product_name !== 'string' || product_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Product name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get user ID from auth header if present
    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    console.log('[submit-unknown-product] Processing:', { barcode, product_name, brand_name, category, userId });

    // Check if product already exists (race condition safety)
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id, brand_id')
      .eq('barcode', barcode)
      .limit(1)
      .maybeSingle();

    if (existingProduct) {
      console.log('[submit-unknown-product] Product already exists:', existingProduct);
      
      // Get brand info
      const { data: existingBrand } = await supabase
        .from('brands')
        .select('id, slug')
        .eq('id', existingProduct.brand_id)
        .maybeSingle();
      
      return new Response(
        JSON.stringify({
          product_id: existingProduct.id,
          brand_id: existingProduct.brand_id,
          brand_slug: existingBrand?.slug || null,
          already_exists: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find or create brand
    let brandId: string | null = null;
    let brandSlug: string | null = null;

    if (brand_name && brand_name.trim().length > 0) {
      const normalizedBrandName = brand_name.trim();
      const candidateSlug = generateSlug(normalizedBrandName);

      // Step 1: Try exact slug match first (most deterministic)
      const { data: slugMatch } = await supabase
        .from('brands')
        .select('id, slug')
        .eq('slug', candidateSlug)
        .maybeSingle();

      if (slugMatch) {
        brandId = slugMatch.id;
        brandSlug = slugMatch.slug;
        console.log('[submit-unknown-product] Found brand by slug:', slugMatch);
      } else {
        // Step 2: Try exact name match (case-insensitive but exact)
        const { data: nameMatch } = await supabase
          .from('brands')
          .select('id, slug')
          .ilike('name', normalizedBrandName)
          .maybeSingle();

        if (nameMatch) {
          brandId = nameMatch.id;
          brandSlug = nameMatch.slug;
          console.log('[submit-unknown-product] Found brand by exact name:', nameMatch);
        } else {
          // Step 3: Create new brand stub with collision-safe slug
          const availableSlug = await findAvailableSlug(supabase, candidateSlug);
          
          const { data: newBrand, error: brandError } = await supabase
            .from('brands')
            .insert({
              name: normalizedBrandName,
              slug: availableSlug,
              status: 'stub',
              identity_confidence: 'low',
            })
            .select('id, slug')
            .single();

          if (brandError) {
            console.error('[submit-unknown-product] Brand creation failed:', brandError);
            throw brandError;
          }

          brandId = newBrand.id;
          brandSlug = newBrand.slug;
          console.log('[submit-unknown-product] Created brand stub:', { brandId, brandSlug });
        }
      }
    } else {
      // No brand name provided - create a unique placeholder brand per barcode
      const placeholderName = `Unknown Brand (barcode: ${barcode})`;
      const placeholderSlug = `unknown-barcode-${barcode}`;

      // Check if this exact placeholder already exists
      const { data: existingPlaceholder } = await supabase
        .from('brands')
        .select('id, slug')
        .eq('slug', placeholderSlug)
        .maybeSingle();

      if (existingPlaceholder) {
        brandId = existingPlaceholder.id;
        brandSlug = existingPlaceholder.slug;
        console.log('[submit-unknown-product] Found existing placeholder:', existingPlaceholder);
      } else {
        const { data: newBrand, error: brandError } = await supabase
          .from('brands')
          .insert({
            name: placeholderName,
            slug: placeholderSlug,
            status: 'stub',
            identity_confidence: 'low',
          })
          .select('id, slug')
          .single();

        if (brandError) {
          console.error('[submit-unknown-product] Placeholder brand creation failed:', brandError);
          throw brandError;
        }

        brandId = newBrand.id;
        brandSlug = newBrand.slug;
        console.log('[submit-unknown-product] Created placeholder brand:', { brandId, brandSlug });
      }
    }

    // Create product record
    const { data: newProduct, error: productError } = await supabase
      .from('products')
      .insert({
        barcode,
        name: product_name.trim(),
        brand_id: brandId,
        category: category || null,
        confidence_score: 40, // Low confidence for user-submitted
        metadata: {
          submitted_by: userId,
          submitted_at: new Date().toISOString(),
        },
      })
      .select('id')
      .single();

    if (productError) {
      console.error('[submit-unknown-product] Product creation failed:', productError);
      throw productError;
    }

    console.log('[submit-unknown-product] Created product:', newProduct);

    // If user is authenticated, set up follow for notifications
    if (userId && brandId) {
      const { error: followError } = await supabase
        .from('user_follows')
        .upsert({
          user_id: userId,
          brand_id: brandId,
          notifications_enabled: true,
        }, {
          onConflict: 'user_follows_user_brand_unique',
        });

      if (followError) {
        console.warn('[submit-unknown-product] Failed to set up follow:', followError);
      } else {
        console.log('[submit-unknown-product] Set up follow for user:', userId);
      }
    }

    return new Response(
      JSON.stringify({
        product_id: newProduct.id,
        brand_id: brandId,
        brand_slug: brandSlug,
        success: true,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[submit-unknown-product] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
