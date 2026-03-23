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
    .normalize('NFC')
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

async function resolveBrand(
  supabase: any,
  brandRaw: string,
  brandDisplay: string | null
): Promise<{ brandId: string | null; method: string }> {
  if (!brandRaw || brandRaw.length <= 1) return { brandId: null, method: 'none' };

  // 1. Alias match
  const { data: alias } = await supabase
    .from('brand_aliases')
    .select('canonical_brand_id')
    .or(`external_name.ilike.${brandRaw},external_name.ilike.${brandDisplay}`)
    .maybeSingle();

  if (alias) return { brandId: alias.canonical_brand_id, method: 'alias' };

  // 2. Normalized name match
  const { data: existingBrand } = await supabase
    .from('brands')
    .select('id')
    .ilike('name', brandRaw)
    .maybeSingle();

  if (existingBrand) return { brandId: existingBrand.id, method: 'normalized' };

  // 3. Fuzzy match via pg_trgm
  const minSimilarity = brandRaw.length < 6 ? 0.75 : 0.6;
  const { data: fuzzyMatch } = await supabase
    .rpc('search_brands_fuzzy', { search_term: brandRaw, min_similarity: minSimilarity })
    .limit(1);

  if (fuzzyMatch && fuzzyMatch.length > 0) {
    const matchedId = fuzzyMatch[0].id;
    // Auto-create alias + log for review
    await supabase.from('brand_aliases').insert({
      external_name: brandDisplay || brandRaw,
      canonical_brand_id: matchedId,
      source: 'openfoodfacts_fuzzy',
    }).maybeSingle();
    await supabase.from('fuzzy_alias_review').insert({
      external_name: brandDisplay || brandRaw,
      matched_brand_id: matchedId,
      matched_brand_name: fuzzyMatch[0].name ?? null,
      similarity_score: fuzzyMatch[0].similarity ?? null,
      source: 'openfoodfacts_fuzzy',
    }).maybeSingle();
    return { brandId: matchedId, method: 'fuzzy' };
  }

  // 4. Create new brand
  if (brandRaw.length > 2 && !/^\d+$/.test(brandRaw)) {
    const { data: newBrand } = await supabase
      .from('brands')
      .insert({ name: brandDisplay || brandRaw })
      .select('id')
      .single();
    if (newBrand) return { brandId: newBrand.id, method: 'created' };
  }

  return { brandId: null, method: 'unmapped' };
}

async function importPage(
  supabase: any,
  category: string,
  country: string,
  page: number,
  pageSize: number
): Promise<{
  inserted: number;
  skippedNoBarcode: number;
  skippedDuplicate: number;
  brandsCreated: number;
  brandsMapped: number;
  unmappedBrands: string[];
  totalPages: number;
  totalProducts: number;
}> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?action=process&tagtype_0=countries&tag_contains_0=contains&tag_0=${encodeURIComponent(country)}&tagtype_1=categories&tag_contains_1=contains&tag_1=${encodeURIComponent(category)}&page_size=${pageSize}&page=${page}&json=1&fields=code,product_name,brands,categories_tags,image_url,image_front_url`;

  const offRes = await fetch(url, {
    headers: { 'User-Agent': 'BarcodeTruth/1.0 (contact@barcodetruth.app)' },
  });

  if (!offRes.ok) throw new Error(`OFF API returned ${offRes.status}`);

  const offData = await offRes.json();
  const products: OFFProduct[] = offData.products ?? [];
  const totalPages = Math.ceil((offData.count ?? 0) / pageSize);

  let inserted = 0, skippedNoBarcode = 0, skippedDuplicate = 0, brandsCreated = 0, brandsMapped = 0;
  const unmappedBrands: string[] = [];

  for (const p of products) {
    if (!p.code || p.code.length < 8 || (!p.product_name && !p.brands)) {
      skippedNoBarcode++;
      continue;
    }

    const brandRaw = p.brands ? normalizeBrandName(p.brands) : null;
    const brandDisplay = p.brands ? displayBrandName(p.brands) : null;
    let brandId: string | null = null;

    if (brandRaw && brandRaw.length > 1) {
      const result = await resolveBrand(supabase, brandRaw, brandDisplay);
      brandId = result.brandId;
      if (result.method === 'created') brandsCreated++;
      else if (result.method === 'unmapped') unmappedBrands.push(brandRaw);
      else if (brandId) brandsMapped++;
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
      if (insertErr.code === '23505') skippedDuplicate++;
      else console.warn(`[bulk-import-off] Insert error for ${p.code}:`, insertErr.message);
    } else {
      inserted++;
    }
  }

  return { inserted, skippedNoBarcode, skippedDuplicate, brandsCreated, brandsMapped, unmappedBrands, totalPages, totalProducts: offData.count ?? 0 };
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
    const startPage = body.page ?? 1;
    const maxPages = Math.min(body.max_pages ?? 1, 20); // cap at 20 pages per call
    const pageSize = Math.min(body.page_size ?? 200, 200);
    const category = body.category ?? 'beverages';
    const country = body.country ?? 'united-states';

    console.log(`[bulk-import-off] Starting: category=${category}, pages=${startPage}-${startPage + maxPages - 1}, size=${pageSize}`);

    let totalInserted = 0, totalSkippedDupe = 0, totalBrandsCreated = 0, totalBrandsMapped = 0;
    let lastTotalPages = 0, lastTotalProducts = 0;
    const allUnmapped: string[] = [];
    const pageResults: { page: number; inserted: number; duration_ms: number }[] = [];

    for (let p = startPage; p < startPage + maxPages; p++) {
      const pt = performance.now();
      try {
        const result = await importPage(supabase, category, country, p, pageSize);
        totalInserted += result.inserted;
        totalSkippedDupe += result.skippedDuplicate;
        totalBrandsCreated += result.brandsCreated;
        totalBrandsMapped += result.brandsMapped;
        lastTotalPages = result.totalPages;
        lastTotalProducts = result.totalProducts;
        allUnmapped.push(...result.unmappedBrands);
        pageResults.push({ page: p, inserted: result.inserted, duration_ms: Math.round(performance.now() - pt) });

        console.log(`[bulk-import-off] Page ${p}: +${result.inserted} products`);

        // Stop if we've gone past available pages
        if (p >= result.totalPages) {
          console.log(`[bulk-import-off] Reached last page (${result.totalPages})`);
          break;
        }

        // Rate limit: 1s pause between OFF API calls
        if (p < startPage + maxPages - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (pageErr: any) {
        console.error(`[bulk-import-off] Page ${p} error:`, pageErr.message);
        pageResults.push({ page: p, inserted: 0, duration_ms: Math.round(performance.now() - pt) });
        // Continue to next page on error
      }
    }

    const dur = Math.round(performance.now() - t0);
    const result = {
      ok: true,
      inserted: totalInserted,
      skipped_duplicate: totalSkippedDupe,
      brands_created: totalBrandsCreated,
      brands_mapped: totalBrandsMapped,
      unmapped_brands_sample: [...new Set(allUnmapped)].slice(0, 10),
      pages_processed: pageResults.length,
      page_results: pageResults,
      page: startPage,
      max_pages: maxPages,
      total_pages: lastTotalPages,
      total_off_products: lastTotalProducts,
      duration_ms: dur,
    };

    console.log(`[bulk-import-off] Done: ${totalInserted} inserted across ${pageResults.length} pages in ${dur}ms`);

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
