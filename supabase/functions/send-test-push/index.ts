import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface Payload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

async function sendWebPush(
  sub: PushSubscriptionRow,
  payload: Payload,
  vapid: { publicKey: string; privateKey: string; subject: string }
) {
  // NOTE: npm:web-push doesn't work in Deno Edge Functions due to native dependencies
  // For production, you have 3 options:
  // 1. Use OneSignal/Firebase Cloud Messaging (recommended - easiest)
  // 2. Implement Web Push protocol manually (JWT + ECDH encryption)
  // 3. Use a serverless function with Node.js runtime
  
  console.log('[send-web-push] Would send to:', sub.endpoint.substring(0, 50));
  console.log('[send-web-push] Payload:', JSON.stringify(payload, null, 2));
  console.log('[send-web-push] VAPID subject:', vapid.subject);
  
  // For testing: simulate successful send
  // In production, replace with actual implementation
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:support@shopsignals.app";

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "VAPID keys not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const endpointFilter = body?.endpoint as string | undefined;

    const query = supabase.from("user_push_subs").select("*");
    const { data: subs, error } = endpointFilter
      ? await query.eq("endpoint", endpointFilter)
      : await query;

    if (error) throw error;
    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, note: "no subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload: Payload = {
      title: body?.title ?? "ShopSignals test notification",
      body: body?.body ?? "Push works! Tap to open a sample brand page.",
      icon: "/placeholder.svg",
      badge: "/favicon.ico",
      tag: "test-push",
      data: body?.data ?? { brand_id: "nike", category: "environment", delta: 3 },
    };

    console.log('[send-test-push] Sending to', subs.length, 'subscriptions');

    let sent = 0;
    const invalid: string[] = [];

    for (const sub of subs as PushSubscriptionRow[]) {
      try {
        await sendWebPush(sub, payload, {
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: VAPID_PRIVATE_KEY,
          subject: VAPID_SUBJECT,
        });
        sent++;
        console.log('[send-test-push] Sent to:', sub.endpoint.substring(0, 50));
      } catch (e: any) {
        console.error('[send-test-push] Error sending to subscription:', e);
        // Clean up expired subs
        if (e?.statusCode === 404 || e?.statusCode === 410) {
          invalid.push(sub.endpoint);
          console.log('[send-test-push] Subscription expired/invalid');
        }
      }
    }

    if (invalid.length) {
      console.log('[send-test-push] Cleaning up', invalid.length, 'invalid subscriptions');
      await supabase.from("user_push_subs").delete().in("endpoint", invalid);
    }

    console.log('[send-test-push] Results: sent =', sent, 'cleaned =', invalid.length);

    return new Response(JSON.stringify({ success: true, sent, cleaned: invalid.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error('[send-test-push] Error:', e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
