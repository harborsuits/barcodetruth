import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, okJson, errJson } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  try {
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
      return okJson({ ok: true, merged: 0, remaining: 0 }, req);
    }

    // Call the SQL merge function (pass explicit param to avoid overloading ambiguity)
    const { data, error } = await supabase.rpc("merge_staged_products_batch", { batch_size: 200 });

    if (error) {
      console.error("[merge-products] merge error", error);
      return errJson(500, error.message, req);
    }

    console.log("[merge-products] Merge complete:", data);
    return okJson({ ok: true, ...data }, req);
  } catch (e: any) {
    console.error("[merge-products] error", e);
    return errJson(500, e?.message ?? "internal error", req);
  }
});
