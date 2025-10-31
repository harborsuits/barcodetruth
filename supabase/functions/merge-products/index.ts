import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);

  // IMPORTANT: admin client – do NOT forward req headers; ignore user's Authorization
  const admin = createClient(url, key);

  try {
    const { data, error } = await admin.rpc("merge_staged_products_batch");
    if (error) {
      console.error("[merge-products] RPC error:", error);
      return json({ error: error.message }, 500);
    }

    const merged =
      data?.merged ?? data?.inserted ?? data?.count ?? 0;

    // Remaining is best-effort; never fail the request because of it
    let remaining: number | null = null;
    const { count } = await admin.from("staging_products").select("*", { count: "exact", head: true });
    if (typeof count === "number") remaining = count;

    return json({ merged, remaining }, 200);
  } catch (e: any) {
    console.error("[merge-products] fatal:", e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
