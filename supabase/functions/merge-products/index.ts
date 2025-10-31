import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { batch_size } = await req.json().catch(() => ({ batch_size: 200 }));
    const batch = Number.isFinite(+batch_size) ? +batch_size : 200;

    const { data, error } = await supabase
      .rpc("merge_staged_products_batch", { batch_size: batch });

    if (error) {
      console.error("[merge-products] RPC error:", error);
      return new Response(
        JSON.stringify({ ok: false, code: "rpc_error", message: error.message, details: error.details }),
        { status: 500, headers: cors },
      );
    }

    const row = Array.isArray(data) ? data[0] : data;
    console.log("[merge-products] Success:", row);
    return new Response(JSON.stringify({ ok: true, ...row }), { headers: cors });
  } catch (e: any) {
    console.error("[merge-products] handler error:", e);
    return new Response(
      JSON.stringify({ ok: false, code: "handler_error", message: String(e?.message || e) }),
      { status: 500, headers: cors },
    );
  }
});
