# Push Notifications Setup

## Overview
ShopSignals uses Web Push API with VAPID (Voluntary Application Server Identification) for sending notifications about brand score changes.

## Generating VAPID Keys

You need to generate a VAPID key pair for your project. Use one of these methods:

### Method 1: Using web-push (Node.js)
```bash
npx web-push generate-vapid-keys
```

### Method 2: Using online generator
Visit: https://vapidkeys.com/

### Method 3: Manual (Node.js script)
```javascript
const webpush = require('web-push');
const vapidKeys = webpush.generateVAPIDKeys();
console.log('Public Key:', vapidKeys.publicKey);
console.log('Private Key:', vapidKeys.privateKey);
```

## Setting Up Keys

1. Generate your VAPID keys using one of the methods above
2. The keys have already been added as secrets in your project:
   - `VAPID_PUBLIC_KEY` - used by the client to subscribe
   - `VAPID_PRIVATE_KEY` - used by the server to send notifications

3. Add the public key to your `.env` file for local development:
```
VITE_VAPID_PUBLIC_KEY=your_public_key_here
```

## Testing Push Notifications

### 1. Enable notifications in Settings
- Go to Settings page
- Toggle "Score Change Alerts" switch
- Grant notification permission when prompted

### 2. Verify subscription
```javascript
// In browser console
navigator.serviceWorker.ready.then(reg => 
  reg.pushManager.getSubscription().then(sub => 
    console.log('Subscription:', sub)
  )
);
```

### 3. Send test notification
Use the `/send-test-push` edge function (to be created) or manually trigger a score change.

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
