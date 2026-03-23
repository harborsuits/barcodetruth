import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OFFProduct {
  code: string;
  product_name?: string;
  brands?: string;
  categories_tags?: string[];
  image_url?: string;
  image_front_url?: string;
}

function normalizeBrandName(raw: string): string {
  return raw
    .split(',')[0]
    .trim()
    .normalize('NFC')            // Normalize unicode (é vs e+combining)
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|co|corp|company|usa|us|uk|gmbh|sa|sas|ag)\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function displayBrandName(raw: string): string {
  return raw
    .split(',')[0]
    .trim()
    .normalize('NFC')
    .replace(/[™®©]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickCategory(tags: string[] | undefined): string | null {
  if (!tags || tags.length === 0) return null;
  const dominated = tags
    .map(t => t.replace(/^en:/, '').replace(/-/g, ' '))
    .filter(t => t.length > 2 && t.length < 60);
  return dominated[dominated.length - 1] || dominated[0] || null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const t0 = performance.now();
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const page = body.page ?? 1;
    const pageSize = Math.min(body.page_size ?? 100, 200);
    const category = body.category ?? 'beverages';
    const country = body.country ?? 'united-states';

    const url = `https://world.openfoodfacts.org/cgi/search.pl?action=process&tagtype_0=countries&tag_contains_0=contains&tag_0=${encodeURIComponent(country)}&tagtype_1=categories&tag_contains_1=contains&tag_1=${encodeURIComponent(category)}&page_size=${pageSize}&page=${page}&json=1&fields=code,product_name,brands,categories_tags,image_url,image_front_url`;

    console.log(`[bulk-import-off] Fetching page ${page}, category=${category}, country=${country}`);

    const offRes = await fetch(url, {
      headers: { 'User-Agent': 'BarcodeTrauth/1.0 (contact@barcodetruth.app)' },
    });

    if (!offRes.ok) {
      throw new Error(`OFF API returned ${offRes.status}`);
    }

    const offData = await offRes.json();
    const products: OFFProduct[] = offData.products ?? [];
    const totalPages = Math.ceil((offData.count ?? 0) / pageSize);

    let inserted = 0;
    let skippedNoBarcode = 0;
    let skippedDuplicate = 0;
    let brandsCreated = 0;
    let brandsMapped = 0;
    const unmappedBrands: string[] = [];

    for (const p of products) {
      if (!p.code || p.code.length < 8) { skippedNoBarcode++; continue; }
      if (!p.product_name && !p.brands) { skippedNoBarcode++; continue; }

      const brandRaw = p.brands ? normalizeBrandName(p.brands) : null;
      let brandId: string | null = null;

      if (brandRaw && brandRaw.length > 1) {
        // Try exact match first
        const { data: existingBrand } = await supabase
          .from('brands')
          .select('id')
          .ilike('name', brandRaw)
          .maybeSingle();

        if (existingBrand) {
          brandId = existingBrand.id;
          brandsMapped++;
        } else {
          // Try alias match
          const { data: alias } = await supabase
            .from('brand_aliases')
            .select('canonical_brand_id')
            .ilike('external_name', brandRaw)
            .maybeSingle();

          if (alias) {
            brandId = alias.canonical_brand_id;
            brandsMapped++;
          } else {
            // Create brand only if name looks real (>2 chars, not all digits)
            if (brandRaw.length > 2 && !/^\d+$/.test(brandRaw)) {
              const { data: newBrand } = await supabase
                .from('brands')
                .insert({ name: brandRaw })
                .select('id')
                .single();
              if (newBrand) {
                brandId = newBrand.id;
                brandsCreated++;
              }
            } else {
              unmappedBrands.push(brandRaw);
            }
          }
        }
      }

      const productCategory = pickCategory(p.categories_tags);
      const imageUrl = p.image_front_url || p.image_url || null;

      const { error: insertErr } = await supabase
        .from('products')
        .upsert({
          barcode: p.code,
          name: (p.product_name || brandRaw || 'Unknown Product').slice(0, 500),
          brand_id: brandId,
          category: productCategory,
          source: 'openfoodfacts',
          data_source: 'openfoodfacts',
          confidence_score: brandId ? 70 : 30,
          image_url: imageUrl,
          metadata: { off_categories: p.categories_tags?.slice(0, 5) },
        }, { onConflict: 'barcode', ignoreDuplicates: false });

      if (insertErr) {
        if (insertErr.code === '23505') { skippedDuplicate++; }
        else { console.warn(`[bulk-import-off] Insert error for ${p.code}:`, insertErr.message); }
      } else {
        inserted++;
      }
    }

    const dur = Math.round(performance.now() - t0);
    const result = {
      ok: true,
      inserted,
      skipped_no_barcode: skippedNoBarcode,
      skipped_duplicate: skippedDuplicate,
      brands_created: brandsCreated,
      brands_mapped: brandsMapped,
      unmapped_brands_sample: unmappedBrands.slice(0, 10),
      page,
      total_pages: totalPages,
      total_off_products: offData.count ?? 0,
      duration_ms: dur,
    };

    console.log(`[bulk-import-off] Done:`, JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[bulk-import-off] Error:', err);
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
