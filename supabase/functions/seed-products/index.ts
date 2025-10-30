import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function sha1(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buffer = await crypto.subtle.digest("SHA-1", data);
  const bytes = Array.from(new Uint8Array(buffer));
  return bytes.map(x => x.toString(16).padStart(2, "0")).join("");
}

type SeedBody =
  | { mode: "csv"; csv_url: string }
  | { mode: "openfoodfacts"; categories: string[]; limit?: number };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[seed-products] Request received");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: SeedBody;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Bad JSON" }),
      { headers: corsHeaders, status: 400 }
    );
  }

  const rows: Array<{
    source: string;
    barcode: string;
    product_name?: string;
    brand_label?: string;
    category?: string;
  }> = [];

  if (body.mode === "csv") {
    console.log("[seed-products] Fetching CSV from:", body.csv_url);
    const resp = await fetch(body.csv_url);
    if (!resp.ok) {
      return new Response(
        JSON.stringify({ ok: false, error: "CSV fetch failed" }),
        { headers: corsHeaders, status: 400 }
      );
    }
    const text = await resp.text();
    const lines = text.split(/\r?\n/);
    const header = lines.shift()?.split(",") ?? [];
    const idx = (h: string) => header.findIndex(x => x.trim().toLowerCase() === h);
    const iBarcode = idx("barcode");
    const iName = idx("name");
    const iBrand = idx("brand");
    const iCat = idx("category");

    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = line.split(",");
      rows.push({
        source: "csv",
        barcode: cols[iBarcode]?.trim() ?? "",
        product_name: cols[iName]?.trim(),
        brand_label: cols[iBrand]?.trim(),
        category: cols[iCat]?.trim()
      });
    }
  } else {
    // OpenFoodFacts sampler
    const limit = body.limit ?? 500;
    const categories = body.categories.slice(0, 5);
    console.log("[seed-products] Fetching from OpenFoodFacts categories:", categories);

    for (const cat of categories) {
      const url = `https://world.openfoodfacts.org/category/${encodeURIComponent(cat)}.json?page_size=${Math.min(200, limit)}`;
      try {
        const r = await fetch(url);
        if (!r.ok) continue;
        const j = await r.json();
        for (const p of j.products ?? []) {
          const code = (p.code ?? "").toString();
          if (!code) continue;
          rows.push({
            source: "openfoodfacts",
            barcode: code,
            product_name: p.product_name || p.generic_name || null,
            brand_label: (Array.isArray(p.brands_tags) && p.brands_tags[0]) || p.brands || null,
            category: cat
          });
        }
        await new Promise(r => setTimeout(r, 200)); // polite delay
      } catch (e) {
        console.error(`[seed-products] Error fetching category ${cat}:`, e);
      }
    }
  }

  console.log(`[seed-products] Parsed ${rows.length} raw rows`);

  // Build staging inserts (idempotent by content_hash)
  const payload = await Promise.all(
    rows
      .filter(r => r.barcode && /^\d{8,14}$/.test(r.barcode))
      .map(async (r) => ({
        source: r.source,
        barcode: r.barcode,
        product_name: r.product_name ?? null,
        brand_label: r.brand_label ?? null,
        category: r.category ?? null,
        content_hash: await sha1(
          `${r.barcode}|${r.product_name ?? ""}|${r.brand_label ?? ""}|${r.category ?? ""}`
        )
      }))
  );

  console.log(`[seed-products] Inserting ${payload.length} rows into staging`);

  // Insert with ON CONFLICT handled by unique constraint
  const { error, data } = await supabase
    .from("staging_products")
    .upsert(payload, { onConflict: "content_hash", ignoreDuplicates: true });

  if (error) {
    console.error("[seed-products] staging insert error", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: corsHeaders, status: 500 }
    );
  }

  console.log(`[seed-products] Successfully staged ${payload.length} products`);

  return new Response(
    JSON.stringify({ ok: true, staged: payload.length }),
    { headers: corsHeaders }
  );
});
