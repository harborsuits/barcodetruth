import { createClient } from 'npm:@supabase/supabase-js@2';

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
async function findAvailableSlug(supabase: any, baseSlug: string): Promise<string> {
  const { data: base } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', baseSlug)
    .maybeSingle();

  if (!base) return baseSlug;

  for (let suffix = 2; suffix <= 100; suffix++) {
    const candidate = `${baseSlug}-${suffix}`;
    const { data } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!data) return candidate;
  }

  throw new Error('Too many slug collisions');
}

// Normalize barcode: strip leading zeros for comparison (mirrors DB normalize_barcode)
function normalizeBarcode(barcode: string): string {
  return barcode.replace(/^0+/, '') || '0';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { barcode, product_name, brand_name, category, photo_url } = await req.json();

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

    // Soft-gate: photo proof is required for community submissions
    if (!photo_url || typeof photo_url !== 'string' || !photo_url.startsWith('http')) {
      return new Response(
        JSON.stringify({ error: 'A product photo is required to submit. This helps us verify accuracy.' }),
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

    // ── Case 1: Product already exists in main products table ──
    // Check both raw barcode and normalized form
    const { data: existingProduct } = await supabase
      .from('products')
      .select('id, brand_id')
      .or(`barcode.eq.${barcode},barcode.eq.0${barcode},barcode.eq.00${barcode}`)
      .limit(1)
      .maybeSingle();

    if (existingProduct) {
      console.log('[submit-unknown-product] Product already exists:', existingProduct);

      const { data: existingBrand } = await supabase
        .from('brands')
        .select('id, slug')
        .eq('id', existingProduct.brand_id)
        .maybeSingle();

      // Set up follow if authenticated
      if (userId && existingProduct.brand_id) {
        await supabase
          .from('user_follows')
          .upsert({ user_id: userId, brand_id: existingProduct.brand_id, notifications_enabled: true },
            { onConflict: 'user_id,brand_id' });
      }

      return new Response(
        JSON.stringify({
          product_id: existingProduct.id,
          brand_id: existingProduct.brand_id,
          brand_slug: existingBrand?.slug || null,
          already_exists: true,
          status: 'recognized',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Case 2: Barcode already in the unknown_barcodes queue ──
    const { data: existingUnknown } = await supabase
      .from('unknown_barcodes')
      .select('id, barcode, scan_count')
      .eq('barcode', barcode)
      .maybeSingle();

    if (existingUnknown) {
      console.log('[submit-unknown-product] Barcode already in unknown queue, incrementing interest');

      // Increment scan count and update timestamp
      await supabase
        .from('unknown_barcodes')
        .update({
          scan_count: (existingUnknown.scan_count || 1) + 1,
          last_scanned_at: new Date().toISOString(),
        })
        .eq('id', existingUnknown.id);

      return new Response(
        JSON.stringify({
          already_queued: true,
          status: 'under_investigation',
          scan_count: (existingUnknown.scan_count || 1) + 1,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Case 3: Genuinely new — find or create brand, create product ──

    let brandId: string | null = null;
    let brandSlug: string | null = null;

    if (brand_name && brand_name.trim().length > 0) {
      const normalizedBrandName = brand_name.trim();
      const candidateSlug = generateSlug(normalizedBrandName);

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
      const placeholderName = `Unknown Brand (barcode: ${barcode})`;
      const placeholderSlug = `unknown-barcode-${barcode}`;

      const { data: existingPlaceholder } = await supabase
        .from('brands')
        .select('id, slug')
        .eq('slug', placeholderSlug)
        .maybeSingle();

      if (existingPlaceholder) {
        brandId = existingPlaceholder.id;
        brandSlug = existingPlaceholder.slug;
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

        if (brandError) throw brandError;
        brandId = newBrand.id;
        brandSlug = newBrand.slug;
      }
    }

    // Create product — use upsert-style: catch duplicate gracefully
    // Soft-gate: community submissions enter the review queue (review_status='pending')
    const { data: newProduct, error: productError } = await supabase
      .from('products')
      .insert({
        barcode,
        name: product_name.trim(),
        brand_id: brandId,
        category: category || null,
        confidence_score: 40,
        data_source: 'user_submitted',
        community_submitted: true,
        submission_photo_url: photo_url,
        submitted_by: userId,
        review_status: 'pending',
        metadata: {
          submitted_by: userId,
          submitted_at: new Date().toISOString(),
          photo_url,
        },
      })
      .select('id')
      .single();

    if (productError) {
      // If it's a duplicate constraint error, treat as success (race condition)
      if (productError.code === '23505') {
        console.log('[submit-unknown-product] Duplicate product detected (race condition), returning success');

        // Fetch the existing product
        const { data: raceProduct } = await supabase
          .from('products')
          .select('id, brand_id')
          .eq('barcode', barcode)
          .maybeSingle();

        const { data: raceBrand } = raceProduct?.brand_id
          ? await supabase.from('brands').select('id, slug').eq('id', raceProduct.brand_id).maybeSingle()
          : { data: null };

        if (userId && raceProduct?.brand_id) {
          await supabase
            .from('user_follows')
            .upsert({ user_id: userId, brand_id: raceProduct.brand_id, notifications_enabled: true },
              { onConflict: 'user_id,brand_id' });
        }

        return new Response(
          JSON.stringify({
            product_id: raceProduct?.id || null,
            brand_id: raceProduct?.brand_id || brandId,
            brand_slug: raceBrand?.slug || brandSlug,
            already_exists: true,
            status: 'recognized',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.error('[submit-unknown-product] Product creation failed:', productError);
      throw productError;
    }

    console.log('[submit-unknown-product] Created product:', newProduct);

    // Set up follow for notifications
    if (userId && brandId) {
      await supabase
        .from('user_follows')
        .upsert({ user_id: userId, brand_id: brandId, notifications_enabled: true },
          { onConflict: 'user_id,brand_id' })
        .then(({ error }) => {
          if (error) console.warn('[submit-unknown-product] Follow setup failed:', error);
        });
    }

    return new Response(
      JSON.stringify({
        product_id: newProduct.id,
        brand_id: brandId,
        brand_slug: brandSlug,
        success: true,
        status: 'created',
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
