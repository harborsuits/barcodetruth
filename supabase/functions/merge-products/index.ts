import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[merge-products] Starting merge batch");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check how many are staged
  const { count: stagedCount } = await supabase
    .from("staging_products")
    .select("*", { count: "exact", head: true });

  console.log(`[merge-products] Found ${stagedCount} staged products`);

  if (!stagedCount || stagedCount === 0) {
    return new Response(
      JSON.stringify({ ok: true, merged: 0, remaining: 0 }),
      { headers: corsHeaders }
    );
  }

  // Call the SQL merge function
  const { data, error } = await supabase.rpc("merge_staged_products_batch");

  if (error) {
    console.error("[merge-products] merge error", error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message }),
      { headers: corsHeaders, status: 500 }
    );
  }

  console.log("[merge-products] Merge complete:", data);

  return new Response(
    JSON.stringify({ ok: true, ...data }),
    { headers: corsHeaders }
  );
});
