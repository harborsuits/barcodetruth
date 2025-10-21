import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { brand_name } = await req.json();

    if (!brand_name) {
      return new Response(
        JSON.stringify({ error: "brand_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[delete-brand-data] Deleting data for: ${brand_name}`);

    // Get brand IDs first
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

    // Delete in order (foreign keys)
    await supabase
      .from('company_ownership')
      .delete()
      .in('child_brand_id', brandIds);

    await supabase
      .from('products')
      .delete()
      .in('brand_id', brandIds);

    await supabase
      .from('brands')
      .delete()
      .in('id', brandIds);

    // Also delete companies
    await supabase
      .from('companies')
      .delete()
      .ilike('name', `%${brand_name}%`);

    console.log(`[delete-brand-data] ✅ Deleted all data for ${brand_name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted_brands: brands.length,
        message: `Deleted all data for ${brand_name}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('[delete-brand-data] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
