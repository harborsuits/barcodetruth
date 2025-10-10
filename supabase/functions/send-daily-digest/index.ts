import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DigestItem {
  brand_name: string;
  brand_id: string;
  category: string;
  delta: number;
  event_count: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current hour in UTC
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTime = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;

    console.log(`Running digest for time: ${currentTime}`);

    // Get users who want digest mode at this time (within 15 min window)
    const targetHour = String(currentHour).padStart(2, '0');
    const { data: digestUsers, error: usersError } = await supabase
      .from("user_preferences")
      .select("user_id, digest_time")
      .eq("notification_mode", "digest")
      .gte("digest_time", `${targetHour}:00`)
      .lt("digest_time", `${targetHour}:59`);

    if (usersError) throw usersError;

    if (!digestUsers || digestUsers.length === 0) {
      console.log("No users scheduled for digest at this time");
      return new Response(
        JSON.stringify({ message: "No users scheduled", time: currentTime }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${digestUsers.length} users for digest`);

    let sentCount = 0;
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    for (const userPref of digestUsers) {
      // Get user's followed brands
      const { data: follows } = await supabase
        .from("user_follows")
        .select("brand_id")
        .eq("user_id", userPref.user_id);

      if (!follows || follows.length === 0) continue;

      const brandIds = follows.map(f => f.brand_id);

      // Get score changes in last 24h for followed brands
      const { data: events } = await supabase
        .from("brand_events")
        .select(`
          brand_id,
          category,
          brands!inner(name),
          created_at
        `)
        .in("brand_id", brandIds)
        .gte("created_at", yesterday.toISOString())
        .order("created_at", { ascending: false });

      if (!events || events.length === 0) continue;

      // Group by brand and category
      const digest: DigestItem[] = [];
      const grouped = new Map<string, { events: any[], brand_name: string }>();

      for (const event of events) {
        const key = `${event.brand_id}-${event.category}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            events: [],
            brand_name: (event.brands as any).name,
          });
        }
        grouped.get(key)!.events.push(event);
      }

      for (const [key, { events: catEvents, brand_name }] of grouped) {
        const [brand_id, category] = key.split("-");
        digest.push({
          brand_name,
          brand_id,
          category,
          delta: -5 * catEvents.length, // Rough estimate
          event_count: catEvents.length,
        });
      }

      if (digest.length === 0) continue;

      // Fetch push subscriptions for this user (encrypted columns)
      const { data: pushSubs } = await supabase
        .from("user_push_subs")
        .select("endpoint, auth_enc_b64, p256dh_enc_b64")
        .eq("user_id", userPref.user_id);

      if (!pushSubs || pushSubs.length === 0) {
        console.log(`No push subscriptions for user ${userPref.user_id}`);
        continue;
      }

      const title = `Daily Digest: ${digest.length} update${digest.length !== 1 ? 's' : ''}`;
      const body = digest
        .slice(0, 3)
        .map(d => `${d.brand_name}: ${d.event_count} ${d.category} event${d.event_count !== 1 ? 's' : ''}`)
        .join(", ");

      // Build notification payload
      const payload = {
        title,
        body,
        icon: '/placeholder.svg',
        badge: '/favicon.ico',
        tag: 'daily-digest',
        data: { digest, type: 'digest' }
      };

      // Send to all user's subscriptions
      let sentToUser = false;
      for (const sub of pushSubs) {
        try {
          const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              subscription: {
                endpoint: sub.endpoint,
                auth_enc_b64: sub.auth_enc_b64,
                p256dh_enc_b64: sub.p256dh_enc_b64
              },
              brand_id: "digest",
              brand_name: "Daily Digest",
              category: "digest",
              delta: digest.length,
              payload
            }
          });

          if (!pushError) {
            sentToUser = true;
          } else {
            console.error(`Failed to send digest to subscription ${sub.endpoint.substring(0, 50)}:`, pushError);
          }
        } catch (err) {
          console.error(`Error sending digest:`, err);
        }
      }

      // Log digest delivery result
      await supabase.from("notification_log").insert({
        user_id: userPref.user_id,
        brand_id: "digest",
        category: "digest",
        delta: digest.length,
        success: sentToUser,
        error: sentToUser ? null : "Failed to send to any subscription",
      });

      if (sentToUser) {
        sentCount++;
        console.log(`Sent digest to user ${userPref.user_id}: ${title}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        time: currentTime,
        users_notified: sentCount,
        total_users: digestUsers.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-daily-digest:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
