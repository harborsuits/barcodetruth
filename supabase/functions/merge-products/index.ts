import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders, okJson, errJson } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: buildCorsHeaders(req) });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { batch_size, dry_run } = await req.json().catch(() => ({ 
      batch_size: 200, 
      dry_run: false 
    }));
    
    const batchSize = Number.isFinite(+batch_size) ? +batch_size : 200;
    const dryRun = !!dry_run;

    console.log(`[merge-products] Starting merge: batch=${batchSize}, dry_run=${dryRun}`);

    const { data, error } = await supabase
      .rpc("merge_staged_products_batch", { 
        batch_size: batchSize,
        dry_run: dryRun
      });

    if (error) {
      console.error("[merge-products] RPC error:", error);
      return errJson(500, error.message, req);
    }

    const result = Array.isArray(data) ? data[0] : data;
    console.log("[merge-products] Success:", result);
    
    return okJson({
      ok: true,
      merged: result.merged || 0,
      skipped_unmapped: result.skipped_unmapped || 0,
      remaining: result.remaining || 0,
      created_brands: result.created_brands || 0,
      sample_unmapped: result.sample_unmapped || []
    }, req);
  } catch (e: any) {
    console.error("[merge-products] Handler error:", e);
    return errJson(500, String(e?.message || e), req);
  }
});
