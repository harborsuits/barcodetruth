# Subscription System - Production Checklist

## 🎯 What's Implemented

### Database Tables
- ✅ `user_billing` - Stores subscription status, period end, product
- ✅ `stripe_customers` - Maps user_id ↔ stripe_customer_id
- ✅ `stripe_events` - Prevents duplicate webhook processing (idempotency)

### Webhook Events Configured
Enable these two events in Stripe Dashboard → Webhooks:
1. `checkout.session.completed`
2. `customer.subscription.updated`
3. `customer.subscription.deleted`

### Key Features
- ✅ Bulletproof date parsing (Unix → ISO conversion with null safety)
- ✅ Idempotency guard (no duplicate event processing)
- ✅ Reliable user mapping via `client_reference_id` + metadata
- ✅ Frontend banner hides when subscription is active AND period hasn't ended
- ✅ Foreign key constraints for data integrity
- ✅ Performance indexes on user_id, status, period_end

## 🧪 Pre-Launch Test Checklist (5 mins)

Use Stripe Test Mode with these test cards:

### 1. Happy Path
- **Card:** `4242 4242 4242 4242`
- **Test:** Subscribe → Banner hides after refresh
- **Verify:** Row in `user_billing` with `status='active'`

### 2. 3D Secure Authentication
- **Card:** `4000 0025 0000 3155`
- **Test:** Complete the 3DS challenge
- **Verify:** Checkout completes successfully

### 3. Declined Card
- **Card:** `4000 0000 0000 9995`
- **Test:** Payment fails
- **Verify:** No "pro" state in database, banner still shows

### 4. Cancel Subscription
**Option A: Cancel at period end**
- Go to Stripe Dashboard → Subscriptions → Cancel
- **Verify:** Banner stays hidden until `current_period_end`

**Option B: Cancel immediately**
- **Verify:** Webhook updates status to "canceled", banner returns

### 5. Renewal (Advanced)
- Use Stripe Test Clocks to advance time
- **Verify:** `invoice.paid` webhook extends `current_period_end`

## 📊 Database Verification Queries

```sql
-- Check active subscription for a user
SELECT user_id, status, current_period_end, product_id
FROM user_billing
WHERE user_id = 'YOUR_USER_UUID';

-- Verify customer mapping exists
SELECT * FROM stripe_customers
WHERE user_id = 'YOUR_USER_UUID';

-- Check recent webhook events (last 10)
SELECT id, received_at 
FROM stripe_events 
ORDER BY received_at DESC 
LIMIT 10;
```

## 🚀 Go-Live Steps

### 1. Create Live Stripe Resources
- Switch Stripe to **Live Mode**
- Create live products/prices (starts with `price_live_...`)

### 2. Update Supabase Secrets
```bash
# Live mode secrets
STRIPE_SECRET_KEY=sk_live_...
PRICE_SUBSCRIPTION=price_live_...
SUCCESS_URL=https://yourdomain.com/
CANCEL_URL=https://yourdomain.com/
```

### 3. Configure Live Webhook
1. Stripe Dashboard (Live Mode) → Developers → Webhooks
2. Add endpoint: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
4. Copy signing secret → Update Supabase secret:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_live_...
   ```

### 4. Test in Production
- Make a small $1-2 test purchase with real card
- Verify database updates
- Verify banner behavior
- Test cancellation flow

## 🎁 Nice-to-Haves (Future)

### Success Page
Create `/pay/success` that shows:
```typescript
"You're Pro ✅ until {subscription_end}"
```

### Customer Portal
Allow users to manage their own subscriptions:
- Update payment method
- Cancel subscription
- View invoices

Enable in `create-checkout`:
```typescript
const portalSession = await stripe.billingPortal.sessions.create({
  customer: customerId,
  return_url: `${origin}/settings`,
});
```

### Promotion Codes
Add to checkout session:
```typescript
allow_promotion_codes: true
```

### Multiple Tiers
Store tier info in `subscription_data.metadata`:
```typescript
subscription_data: {
  metadata: {
    user_id: user.id,
    tier: "premium" // or "basic", "enterprise"
  }
}
```

## 📝 Current Schema

### user_billing
```sql
user_id UUID PRIMARY KEY
stripe_customer_id TEXT NOT NULL
stripe_subscription_id TEXT
status TEXT (active/canceled/past_due)
product_id TEXT
current_period_end TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

### stripe_customers
```sql
user_id UUID PRIMARY KEY
stripe_customer_id TEXT UNIQUE NOT NULL
created_at TIMESTAMPTZ
```

### stripe_events
```sql
id TEXT PRIMARY KEY
received_at TIMESTAMPTZ
```

## 🔍 Troubleshooting

**Banner still shows after subscription:**
- Hard refresh (Ctrl+Shift+R)
- Check `user_billing` has row with `status='active'`
- Verify `current_period_end > now()`
- Check browser console for errors

**Webhook not processing:**
- Verify webhook secret matches Stripe
- Check edge function logs in Supabase
- Ensure events are selected in Stripe webhook config

**User mapping fails:**
- Verify `client_reference_id` is set in checkout
- Check `stripe_customers` table has mapping
- Ensure webhook has `user_id` in metadata

## ⚠️ Security Note
There's a general auth warning about enabling leaked password protection. Enable in Supabase Dashboard → Authentication → Policies when ready (not subscription-related).
