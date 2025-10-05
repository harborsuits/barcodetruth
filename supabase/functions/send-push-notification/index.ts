import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { open, fromByteaToSealed } from "../_shared/crypto.ts";

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
  vapidKeys: { publicKey: string; privateKey: string; subject: string }
): Promise<boolean> {
  // DRYRUN mode: log but don't send
  const DRYRUN = Deno.env.get('PUSH_DRYRUN') === 'true';
  
  console.log(`[send-web-push] ${DRYRUN ? '[DRYRUN] ' : ''}Would send to:`, subscription.endpoint.substring(0, 50));
  console.log(`[send-web-push] ${DRYRUN ? '[DRYRUN] ' : ''}Payload:`, JSON.stringify(payload, null, 2));
  console.log(`[send-web-push] ${DRYRUN ? '[DRYRUN] ' : ''}VAPID subject:`, vapidKeys.subject);
  
  if (DRYRUN) {
    console.log('[send-web-push] DRYRUN mode: skipping actual send');
    return true;
  }
  
  // NOTE: npm:web-push doesn't work in Deno Edge Functions due to native dependencies
  // For production, you have 3 options:
  // 1. Use OneSignal/Firebase Cloud Messaging (recommended - easiest)
  // 2. Implement Web Push protocol manually (JWT + ECDH encryption)
  // 3. Use a serverless function with Node.js runtime
  
  // For testing: simulate successful send
  // In production, replace with actual implementation (see docs/PRODUCTION_PUSH_SETUP.md)
  return true;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@shopsignals.app';

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      throw new Error('VAPID keys not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { subscription, brand_id, brand_name, category, delta, payload: customPayload } = body;
    
    if (!subscription?.endpoint) {
      return new Response(JSON.stringify({ error: 'subscription required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!brand_id || !brand_name) {
      throw new Error('Missing required fields');
    }

    console.log('[send-push-notification] Sending notification for:', {
      brand: brand_name,
      category,
      delta,
    });

    // Use custom payload if provided (for coalesced notifications), otherwise build default
    const payload: NotificationPayload = customPayload ?? {
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

    // Send to single subscription (decrypt if encrypted)
    try {
      let auth = subscription.auth;
      let p256dh = subscription.p256dh;

      // If encrypted credentials exist, decrypt them
      if (subscription.auth_enc && subscription.p256dh_enc) {
        const { open, fromByteaToSealed } = await import("../_shared/crypto.ts");
        const authSealed = fromByteaToSealed(subscription.auth_enc);
        const p256dhSealed = fromByteaToSealed(subscription.p256dh_enc);
        
        if (authSealed && p256dhSealed) {
          auth = await open(authSealed);
          p256dh = await open(p256dhSealed);
          console.log('[send-push-notification] Using encrypted credentials');
        }
      }

      await sendWebPush(
        {
          endpoint: subscription.endpoint,
          p256dh,
          auth,
        },
        payload,
        {
          publicKey: VAPID_PUBLIC_KEY,
          privateKey: VAPID_PRIVATE_KEY,
          subject: VAPID_SUBJECT,
        }
      );
      
      console.log('[send-push-notification] Sent successfully to:', subscription.endpoint.substring(0, 50));

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      console.error('[send-push-notification] Error sending:', error);
      
      // Check for expired subscription
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const statusCode = (error as { statusCode: number }).statusCode;
        if (statusCode === 410 || statusCode === 404) {
          // Clean up invalid subscription
          await supabase
            .from('user_push_subs')
            .delete()
            .eq('endpoint', subscription.endpoint);
          
          console.log('[send-push-notification] Cleaned up expired subscription');
        }
      }
      
      throw error;
    }
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
