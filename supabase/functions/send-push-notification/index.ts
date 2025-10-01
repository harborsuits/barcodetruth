import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, any>;
}

// Use esm.sh for web-push since it's a Node package
async function sendWebPush(
  subscription: PushSubscription,
  payload: NotificationPayload,
  vapidKeys: { publicKey: string; privateKey: string }
): Promise<boolean> {
  try {
    // For now, we'll stub this out and implement in a follow-up
    // The actual implementation would use web-push protocol with VAPID
    console.log('[send-push] Would send notification to:', subscription.endpoint);
    console.log('[send-push] Payload:', payload);
    
    // TODO: Implement actual web push protocol
    // This requires:
    // 1. Generate JWT with VAPID keys
    // 2. Encrypt payload with subscription keys (ECDH)
    // 3. POST to subscription endpoint with encrypted payload
    
    return true;
  } catch (error: any) {
    console.error('[send-push] Error sending notification:', error);
    
    // Handle specific error codes
    if (error.statusCode === 410 || error.statusCode === 404) {
      console.log('[send-push] Subscription expired/invalid, should be removed');
      return false;
    }
    
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { brand_id, brand_name, category, delta } = await req.json();

    if (!brand_id || !brand_name || !category || delta === undefined) {
      throw new Error('Missing required fields');
    }

    console.log('[send-push] Sending notifications for brand:', brand_name);

    // TODO: Find users following this brand
    // For now, fetch all subscriptions (will be filtered by follows in Phase 3)
    const { data: subscriptions, error: subError } = await supabase
      .from('user_push_subs')
      .select('*');

    if (subError) {
      console.error('[send-push] Error fetching subscriptions:', subError);
      throw subError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('[send-push] No subscriptions found');
      return new Response(
        JSON.stringify({ success: true, sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-push] Found', subscriptions.length, 'subscriptions');

    const payload: NotificationPayload = {
      title: `${brand_name} score updated`,
      body: `${category} ${delta > 0 ? '+' : ''}${delta} (last 24h). Tap to view.`,
      icon: '/placeholder.svg',
      badge: '/favicon.ico',
      tag: `score-change-${brand_id}`,
      data: {
        brand_id,
        category,
        delta,
      },
    };

    let sent = 0;
    let failed = 0;
    const failedSubscriptions: string[] = [];

    for (const sub of subscriptions) {
      try {
        const success = await sendWebPush(
          {
            endpoint: sub.endpoint,
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
          payload,
          {
            publicKey: vapidPublicKey,
            privateKey: vapidPrivateKey,
          }
        );

        if (success) {
          sent++;
        } else {
          // Subscription is invalid/expired, mark for deletion
          failedSubscriptions.push(sub.endpoint);
          failed++;
        }
      } catch (error) {
        console.error('[send-push] Failed to send to subscription:', error);
        failed++;
      }
    }

    // Clean up invalid subscriptions
    if (failedSubscriptions.length > 0) {
      console.log('[send-push] Cleaning up', failedSubscriptions.length, 'invalid subscriptions');
      await supabase
        .from('user_push_subs')
        .delete()
        .in('endpoint', failedSubscriptions);
    }

    console.log('[send-push] Results: sent =', sent, 'failed =', failed);

    return new Response(
      JSON.stringify({ success: true, sent, failed }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[send-push] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
