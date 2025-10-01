# Production Push Setup with OneSignal

This guide shows how to replace the stubbed push implementation with OneSignal for production use.

## Why OneSignal?

- ✅ Free tier: 10k subscribers, unlimited notifications
- ✅ Handles all Web Push complexity (VAPID, encryption, retry logic)
- ✅ Works across all browsers (Chrome, Firefox, Safari)
- ✅ Built-in analytics and debugging
- ✅ Simple REST API
- ✅ No credit card required for free tier

## Setup Steps (30 minutes)

### 1. Create OneSignal Account
1. Go to https://onesignal.com/
2. Sign up (free)
3. Create new app → choose "Web Push"
4. Follow their setup wizard

### 2. Get Your Keys
You'll need:
- `ONESIGNAL_APP_ID` (from Settings → Keys & IDs)
- `ONESIGNAL_API_KEY` (REST API Key)

Add these to your Supabase secrets.

### 3. Update Client Code

Replace `src/lib/pushNotifications.ts`:

\`\`\`typescript
import OneSignal from 'react-onesignal';

export async function initOneSignal() {
  await OneSignal.init({
    appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
    serviceWorkerPath: '/OneSignalSDKWorker.js',
    allowLocalhostAsSecureOrigin: true,
  });
}

export async function subscribeToPush(): Promise<boolean> {
  try {
    await OneSignal.showNativePrompt();
    const subscribed = await OneSignal.isPushNotificationsEnabled();
    
    if (subscribed) {
      const userId = await OneSignal.getUserId();
      console.log('OneSignal user ID:', userId);
      // Optionally store userId in your database
    }
    
    return subscribed;
  } catch (error) {
    console.error('OneSignal subscribe error:', error);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    await OneSignal.setSubscription(false);
    return true;
  } catch (error) {
    console.error('OneSignal unsubscribe error:', error);
    return false;
  }
}
\`\`\`

### 4. Update Server Code

Replace `sendWebPush` in `send-test-push/index.ts`:

\`\`\`typescript
async function sendOneSignalNotification(
  userIds: string[],
  payload: Payload
) {
  const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID')!;
  const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_API_KEY')!;

  const response = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Authorization': \`Basic \${ONESIGNAL_API_KEY}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: userIds, // OneSignal user IDs
      contents: { en: payload.body },
      headings: { en: payload.title },
      data: payload.data,
      large_icon: payload.icon,
      small_icon: payload.badge,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(\`OneSignal error: \${error}\`);
  }

  return await response.json();
}
\`\`\`

### 5. Update Database Schema

Add OneSignal user ID to track users:

\`\`\`sql
ALTER TABLE user_push_subs 
ADD COLUMN onesignal_id TEXT;

CREATE INDEX idx_user_push_subs_onesignal ON user_push_subs(onesignal_id);
\`\`\`

### 6. Jobs-Runner Integration

In `calculate-brand-score`, after detecting score delta ≥5:

\`\`\`typescript
// Find users following this brand with OneSignal IDs
const { data: followers } = await supabase
  .from('user_push_subs')
  .select('onesignal_id')
  .not('onesignal_id', 'is', null);

if (followers && followers.length > 0) {
  await supabase.functions.invoke('send-push-notification', {
    body: {
      onesignal_ids: followers.map(f => f.onesignal_id),
      brand_id: brandId,
      brand_name: brand.name,
      category: 'environment',
      delta: 7
    }
  });
}
\`\`\`

## Testing

1. Enable notifications in your app
2. Check OneSignal dashboard → Audience → All Users (should see 1 subscriber)
3. Send test notification from OneSignal dashboard
4. Verify notification appears

## Cost

OneSignal free tier:
- 10,000 subscribers
- Unlimited notifications
- Basic analytics

Paid plans start at $9/month for 20k subscribers.

## Alternatives

If OneSignal doesn't fit:

### Firebase Cloud Messaging (FCM)
- Free (Google Cloud quotas)
- More complex setup
- Better if already using Firebase
- Guide: https://firebase.google.com/docs/cloud-messaging/js/client

### AWS SNS
- Pay per notification ($0.50 per million)
- Most complex setup
- Good for AWS-heavy stacks

### Pusher Beams
- $0.01 per 1000 notifications
- Similar to OneSignal
- Good alternative

## Support

OneSignal has excellent docs and support:
- Docs: https://documentation.onesignal.com/docs/web-push-quickstart
- Debugging: https://documentation.onesignal.com/docs/troubleshooting-web-push
- Support: support@onesignal.com
