import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type DigestHit = {
  brand_id: string;
  events_count: number;
  top_categories: string[];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  console.log(`[digest] Processing events from ${start.toISOString()} to ${now.toISOString()}`);

  // 1) Pull events in the last 24h
  const { data: events, error: evErr } = await supabase
    .from("brand_events")
    .select("brand_id, category")
    .gte("created_at", start.toISOString())
    .lt("created_at", now.toISOString());

  if (evErr) {
    console.error("[digest] events error", evErr);
    return new Response(JSON.stringify({ ok: false, error: evErr.message }), {
      headers: corsHeaders, status: 500
    });
  }

  console.log(`[digest] Found ${events?.length || 0} events in last 24h`);

  // 2) Aggregate per brand
  const map = new Map<string, { count: number; categories: Record<string, number> }>();
  for (const e of events ?? []) {
    const key = e.brand_id as string;
    if (!map.has(key)) map.set(key, { count: 0, categories: {} });
    const m = map.get(key)!;
    m.count += 1;
    const c = (e.category ?? "other") as string;
    m.categories[c] = (m.categories[c] ?? 0) + 1;
  }

  const digest: DigestHit[] = [...map.entries()].map(([brand_id, v]) => {
    const top = Object.entries(v.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([c]) => c);
    return { brand_id, events_count: v.count, top_categories: top };
  });

  console.log(`[digest] Aggregated ${digest.length} brands with new events`);

  // 3) (Optional) persist digest to brand_daily_digest table if it exists
  if (digest.length) {
    const rows = digest.map(d => ({
      brand_id: d.brand_id,
      window_start: start.toISOString(),
      window_end: now.toISOString(),
      events_count: d.events_count,
      top_categories: d.top_categories
    }));
    
    // Try to insert, but don't fail if table doesn't exist
    const { error: insertErr } = await supabase
      .from("brand_daily_digest")
      .insert(rows);
    
    if (insertErr) {
      console.log("[digest] Could not persist to brand_daily_digest:", insertErr.message);
    } else {
      console.log(`[digest] Persisted ${rows.length} digest entries`);
    }
  }

  // 4) Find users who scanned these brands recently (last 90d)
  const brandIds = digest.map(d => d.brand_id);
  if (brandIds.length === 0) {
    console.log("[digest] No brands with new events, exiting");
    return new Response(JSON.stringify({ ok: true, digests: 0, notifications_sent: 0 }), { headers: corsHeaders });
  }

  const { data: scans, error: scansErr } = await supabase
    .from("user_scans")
    .select("user_id, brand_id")
    .in("brand_id", brandIds)
    .gte("scanned_at", new Date(now.getTime() - 90*24*60*60*1000).toISOString());

  if (scansErr) {
    console.error("[digest] scans error", scansErr);
    return new Response(JSON.stringify({ ok: false, error: scansErr.message }), {
      headers: corsHeaders, status: 500
    });
  }

  console.log(`[digest] Found ${scans?.length || 0} recent user scans for these brands`);

  // 5) Compose per-user payload
  const brandsByUser = new Map<string, Set<string>>();
  for (const s of scans ?? []) {
    const uid = s.user_id as string;
    const bid = s.brand_id as string;
    if (!brandsByUser.has(uid)) brandsByUser.set(uid, new Set());
    brandsByUser.get(uid)!.add(bid);
  }

  console.log(`[digest] Preparing to notify ${brandsByUser.size} users`);

  // Adapter stub: replace with OneSignal/FCM later
  async function sendDigest(userId: string, hits: DigestHit[]) {
    // TODO: swap with real provider; for now write to a log table or just console
    console.log(JSON.stringify({ 
      level: "info", 
      type: "digest_notification", 
      userId, 
      hits_count: hits.length,
      total_events: hits.reduce((sum, h) => sum + h.events_count, 0)
    }));
    
    // Future: call OneSignal API or send-push-notification function
    // await supabase.functions.invoke('send-push-notification', {
    //   body: {
    //     user_id: userId,
    //     title: "Daily Update",
    //     body: `${hits.length} brands you follow have ${hits.reduce((s,h) => s + h.events_count, 0)} new events`,
    //     data: { type: 'digest', hits }
    //   }
    // });
  }

  let sent = 0;
  for (const [uid, set] of brandsByUser.entries()) {
    const hits = digest.filter(d => set.has(d.brand_id));
    if (!hits.length) continue;
    await sendDigest(uid, hits);
    sent++;
  }

  console.log(`[digest] Completed: ${digest.length} brands, ${sent} notifications prepared`);

  return new Response(JSON.stringify({ 
    ok: true, 
    digests: digest.length, 
    notifications_sent: sent,
    timestamp: now.toISOString()
  }), {
    headers: corsHeaders
  });
});
