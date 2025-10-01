# Push Notifications Setup

## Overview
ShopSignals uses Web Push API with VAPID (Voluntary Application Server Identification) for sending notifications about brand score changes.

**Current Status:** ✅ Subscription flow fully working | ⚠️ Actual push sending stubbed (see Production Options below)

## Quick Test

### 1. Enable notifications
- Go to Settings → toggle "Score Change Alerts"
- Grant permission when prompted
- Click "Send Test Notification"

### 2. Verify subscription
```javascript
// In browser console
navigator.serviceWorker.ready.then(reg => 
  reg.pushManager.getSubscription().then(sub => {
    console.log('Subscription:', sub);
    console.log('Endpoint:', sub?.endpoint);
  })
);
```

### 3. Check database
Your subscription should be in `user_push_subs` table with your user_id.

## Production Options for Actual Push Sending

The subscription infrastructure is complete, but actual push message delivery requires one of these approaches:

### Option 1: OneSignal (Recommended - Easiest)
- Free tier: 10k subscribers
- Handles all Web Push complexity
- Simple REST API
- ~30 min integration

```typescript
// Replace stub in send-test-push with:
await fetch('https://onesignal.com/api/v1/notifications', {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    app_id: ONESIGNAL_APP_ID,
    include_player_ids: [userId],
    contents: { en: payload.body },
    headings: { en: payload.title }
  })
});
```

### Option 2: Firebase Cloud Messaging
- Free (Google Cloud quotas apply)
- More complex setup
- Better if you're already using Firebase

### Option 3: Manual Web Push Protocol
Implement JWT signing + payload encryption yourself:
- Generate VAPID JWT
- Encrypt payload with ECDH
- POST to subscription endpoint
- ~200 lines of crypto code

### Option 4: Node.js Runtime
Move push sending to a Node.js serverless function where `web-push` package works.

## What Works Now

✅ Service worker registration
✅ Push subscription creation
✅ Subscription storage in database
✅ Notification permission flow
✅ SW push event handlers
✅ Notification click → app navigation
✅ Subscription management (enable/disable)
✅ Test endpoint (validates flow)

## How It Works

### Client-side Flow
1. User toggles notifications in Settings
2. `subscribeToPush()` requests notification permission
3. Service worker subscribes to push notifications
4. Subscription is saved to `user_push_subs` table

### Server-side Flow
1. `jobs-runner` detects brand score changes ≥5 points
2. Finds users following that brand
3. Fetches their push subscriptions from `user_push_subs`
4. Sends push notification via Web Push API
5. Handles errors (expired subscriptions, etc.)

### Service Worker
1. Receives push event from server
2. Shows notification with brand info
3. Handles notification click → opens brand page

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────→│   subscribe- │────→│ user_push_  │
│   (Settings)│     │   push Edge  │     │   subs      │
└─────────────┘     │   Function   │     └─────────────┘
                    └──────────────┘              ↑
                                                  │
┌─────────────┐     ┌──────────────┐            │
│ jobs-runner │────→│ send-push    │────────────┘
│ (score      │     │ (Web Push    │
│  changes)   │     │  API)        │
└─────────────┘     └──────────────┘
                           │
                           ↓
                    ┌──────────────┐
                    │   Service    │
                    │   Worker     │
                    │  (push event)│
                    └──────────────┘
```

## Notification Payload Format

```json
{
  "title": "Brand Name score updated",
  "body": "Environment +7 (last 24h). Tap to view.",
  "icon": "/placeholder.svg",
  "badge": "/favicon.ico",
  "tag": "score-change-brand-id",
  "data": {
    "brand_id": "brand-uuid",
    "category": "environment",
    "delta": 7
  }
}
```

## Rate Limiting

- Maximum 2 notifications per brand per user per day
- No notifications during quiet hours (10pm-7am local time)
- Batch notifications if multiple categories change

## Error Handling

- **410 Gone**: Subscription expired → delete from database
- **401/403**: Invalid VAPID keys → check secrets
- **Network errors**: Retry with exponential backoff (max 3 retries)

## Database Schema

```sql
CREATE TABLE public.user_push_subs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  ua TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

## Security Considerations

- VAPID private key must be kept secret (stored in Supabase secrets)
- Subscriptions are user-specific (RLS policies enforce this)
- Notifications only sent for brands user is following
- Rate limiting prevents spam

## Troubleshooting

### Notifications not appearing
1. Check browser permissions (Settings → Notifications)
2. Verify service worker is registered (DevTools → Application → Service Workers)
3. Check subscription exists in database
4. Verify VAPID keys are correct

### Subscription fails
1. Check VAPID public key is set in environment
2. Ensure HTTPS or localhost (required for service workers)
3. Check browser console for errors

### Notifications not sent
1. Verify jobs-runner is detecting score changes
2. Check edge function logs for errors
3. Verify VAPID private key is set correctly
4. Check push subscription is valid (not expired)
