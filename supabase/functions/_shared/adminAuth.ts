import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Gate an admin-only edge function.
 *
 * Accepts either:
 *  - A cron/internal caller: `x-cron: 1` + `x-internal-token: $INTERNAL_FN_TOKEN`
 *  - An authenticated admin user (JWT in Authorization, role 'admin' in user_roles)
 *
 * Returns a Response (401/403) when access should be denied, or null when
 * the request is authorized to proceed.
 */
export async function requireAdminOrInternal(
  req: Request,
  fnName = "admin-fn",
): Promise<Response | null> {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  // 1) Internal/cron path
  const internalToken = req.headers.get("x-internal-token");
  const expected = Deno.env.get("INTERNAL_FN_TOKEN");
  const fromCron = req.headers.get("x-cron") === "1";
  if (fromCron && expected && internalToken === expected) {
    return null;
  }

  // 2) Admin JWT path
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader) {
    console.warn(`[${fnName}] denied: missing-auth`);
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: cors,
    });
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      console.warn(`[${fnName}] denied: invalid-token`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      console.warn(`[${fnName}] denied: not-admin user=${user.id}`);
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: cors,
      });
    }
    return null;
  } catch (err) {
    console.error(`[${fnName}] auth check failed`, err);
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: cors,
    });
  }
}
