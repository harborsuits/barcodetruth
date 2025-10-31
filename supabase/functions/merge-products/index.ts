import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

function j(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    return j({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  // IMPORTANT: admin client; do NOT forward user's Authorization header
  const supabase = createClient(url, key);

  try {
    // Call RPC
    const { data, error } = await supabase.rpc("merge_staged_products_batch");
    if (error) {
      console.error("[merge-products] RPC error:", error);
      return j({ error: error.message }, 500);
    }

    // Normalize payload
    const merged = data?.merged ?? data?.inserted ?? data?.count ?? 0;

    // Also fetch remaining so UI can show a number
    const { count: remaining, error: cntErr } = await supabase
      .from("staging_products")
      .select("*", { count: "exact", head: true });

    if (cntErr) {
      console.warn("[merge-products] count error:", cntErr);
    }

    return j({ merged, remaining: remaining ?? null }, 200);
  } catch (e: any) {
    console.error("[merge-products] fatal:", e);
    return j({ error: String(e?.message || e) }, 500);
  }
});
