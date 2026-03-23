import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CONFIDENCE_THRESHOLD = 0.7;

// Map Open Food Facts categories to our category slugs
const OFF_CATEGORY_MAP: Record<string, string> = {
  beverages: "beverages",
  "plant-based-foods": "food",
  snacks: "snacks",
  "dairy-products": "dairy",
  cereals: "cereals",
  "frozen-foods": "frozen",
  "canned-foods": "canned",
  "baby-foods": "baby",
  "pet-food": "pet-food",
  "personal-care": "personal-care",
  "household-products": "household",
  "cleaning-products": "household",
  cosmetics: "beauty",
  "hair-care": "beauty",
  "oral-care": "personal-care",
};

// Attribute keywords from Wikidata / descriptions
const ATTRIBUTE_SIGNALS: Record<string, string[]> = {
  sustainable: ["sustainable", "sustainability", "carbon neutral", "net zero", "renewable"],
  green: ["organic", "eco-friendly", "environmentally", "green energy", "solar"],
  local: ["local", "family-owned", "regional", "artisan", "craft"],
  small_business: ["small business", "independent", "startup", "family-run", "boutique"],
  b_corp: ["b corp", "b-corp", "certified b", "benefit corporation"],
  unionized: ["union", "unionized", "collective bargaining", "organized labor"],
  independent: ["independent", "privately held", "private company", "employee-owned"],
  political_left: ["progressive", "liberal", "democratic"],
  political_right: ["conservative", "republican"],
  neutral: ["nonpartisan", "bipartisan", "apolitical"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { batch_size = 50 } = await req.json().catch(() => ({}));
    const limit = Math.min(batch_size, 100);

    // 1. Find brands missing category_slug
    const { data: brandsNeedingCategory } = await sb
      .from("brands")
      .select("id, name, slug, description, wikidata_qid")
      .eq("is_active", true)
      .or("category_slug.is.null,category_slug.eq.")
      .order("created_at", { ascending: false })
      .limit(limit);

    let categorized = 0;
    let attributed = 0;
    const logs: string[] = [];

    for (const brand of brandsNeedingCategory || []) {
      // Try to match category from Open Food Facts by brand name
      try {
        const offRes = await fetch(
          `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(brand.name)}&search_simple=1&json=1&page_size=3`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (offRes.ok) {
          const offData = await offRes.json();
          const products = offData.products || [];
          if (products.length > 0) {
            // Find most common category
            const catCounts: Record<string, number> = {};
            for (const p of products) {
              const cats = (p.categories_tags || []) as string[];
              for (const cat of cats) {
                const slug = cat.replace("en:", "");
                const mapped = OFF_CATEGORY_MAP[slug];
                if (mapped) {
                  catCounts[mapped] = (catCounts[mapped] || 0) + 1;
                }
              }
            }

            const bestCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
            if (bestCat && bestCat[1] / products.length >= CONFIDENCE_THRESHOLD) {
              await sb
                .from("brands")
                .update({ category_slug: bestCat[0] } as any)
                .eq("id", brand.id);

              // Ensure category exists
              await sb
                .from("brand_categories")
                .upsert({ slug: bestCat[0], name: bestCat[0].replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) }, { onConflict: "slug" });

              categorized++;
              logs.push(`${brand.name} → category: ${bestCat[0]} (${Math.round((bestCat[1] / products.length) * 100)}%)`);
            }
          }
        }
      } catch {
        // Skip on timeout/error
      }

      // 2. Detect attributes from brand description
      const desc = (brand.description || "").toLowerCase();
      if (desc.length > 10) {
        const detectedAttrs: { type: string; confidence: number }[] = [];
        for (const [attrType, keywords] of Object.entries(ATTRIBUTE_SIGNALS)) {
          for (const kw of keywords) {
            if (desc.includes(kw)) {
              detectedAttrs.push({ type: attrType, confidence: 0.75 });
              break;
            }
          }
        }

        if (detectedAttrs.length > 0) {
          const rows = detectedAttrs.map((a) => ({
            brand_id: brand.id,
            attribute_type: a.type,
            source: "auto_seed_description",
            confidence: a.confidence,
          }));
          await sb.from("brand_attributes").upsert(rows as any, {
            onConflict: "brand_id,attribute_type",
          });
          attributed += detectedAttrs.length;
          logs.push(`${brand.name} → attrs: ${detectedAttrs.map((a) => a.type).join(", ")}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        processed: (brandsNeedingCategory || []).length,
        categorized,
        attributed,
        logs: logs.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
