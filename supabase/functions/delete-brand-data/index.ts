import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdminOrInternal } from "../_shared/adminAuth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SAFE_ERRORS = {
  invalid_input: "Invalid request data",
  internal_error: "An unexpected error occurred",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Hard kill switch: this endpoint is destructive. Disabled by default;
  // only enabled when ENABLE_DELETE_BRAND_DATA=true is set in env.
  if (Deno.env.get("ENABLE_DELETE_BRAND_DATA") !== "true") {
    return new Response(
      JSON.stringify({ error: "Disabled" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const gate = await requireAdminOrInternal(req, "delete-brand-data");
  if (gate) return gate;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let body: unknown;
    try { body = await req.json(); } catch {
      return new Response(
        JSON.stringify({ error: SAFE_ERRORS.invalid_input }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const brand_name = (body as { brand_name?: unknown })?.brand_name;
    if (!brand_name || typeof brand_name !== "string" || brand_name.trim().length < 2 || brand_name.includes("%")) {
      return new Response(
        JSON.stringify({ error: SAFE_ERRORS.invalid_input }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-brand-data] Deleting data for: ${brand_name}`);

    const { data: brands } = await supabase
      .from('brands')
      .select('id')
      .ilike('name', `%${brand_name}%`);

    if (!brands || brands.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No brands found to delete" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const brandIds = brands.map(b => b.id);

    await supabase.from('company_ownership').delete().in('child_brand_id', brandIds);
    await supabase.from('products').delete().in('brand_id', brandIds);
    await supabase.from('brands').delete().in('id', brandIds);
    await supabase.from('companies').delete().ilike('name', `%${brand_name}%`);

    console.log(`[delete-brand-data] ✅ Deleted all data for ${brand_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted_brands: brands.length,
        message: `Deleted all data for ${brand_name}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[delete-brand-data] Error:', error);
    return new Response(
      JSON.stringify({ error: SAFE_ERRORS.internal_error }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
