# Stripe Payment Setup

## Overview
Your app now supports two payment types:
1. **One-time deposit** - Single payment
2. **Monthly subscription** - Recurring payment

## Required Setup

### 1. Get Your Stripe Price IDs

In your Stripe Dashboard (Test Mode):
1. Go to **Products** 
2. Find your "Website deposit" product → Click **Pricing** → Copy the Price ID (starts with `price_`)
3. Find your "Website plan (monthly)" product → Click **Pricing** → Copy the Price ID

### 2. Configure Supabase Secrets

Run these commands in your terminal:

```bash
# Set your Stripe secrets
supabase secrets set \
  STRIPE_SECRET_KEY=sk_test_YOUR_KEY \
  PRICE_DEPOSIT=price_YOUR_DEPOSIT_ID \
  PRICE_SUBSCRIPTION=price_YOUR_SUBSCRIPTION_ID \
  SUCCESS_URL=https://your-site.lovable.app \
  CANCEL_URL=https://your-site.lovable.app

# Redeploy the function
supabase functions deploy create-checkout
```

### 3. Test the Integration

1. Sign in to your app
2. You'll see a banner with two buttons:
   - **Pay Deposit** - One-time payment
   - **Subscribe Monthly** - Recurring subscription
3. Click either button → Opens Stripe Checkout
4. Use test card: `4242 4242 4242 4242` (any future expiry, any CVC)
5. Complete payment
6. Check Stripe Dashboard → **Payments** to verify

## Optional: Webhook Setup

To track payments in your database:

```bash
# Create and deploy webhook function
supabase functions deploy stripe-webhook

# In Stripe Dashboard → Developers → Webhooks:
# Add endpoint: https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
# Select events: checkout.session.completed, invoice.paid, customer.subscription.*

# Copy the webhook signing secret and set it:
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET
supabase functions deploy stripe-webhook
```

## Feature Flags

Push notifications are currently disabled. The feature flag is in `src/lib/featureFlags.ts`:

```typescript
export const FEATURES = {
  PUSH_NOTIFICATIONS: false, // Enable when OneSignal is integrated
}
```

## What's Working

✅ Stripe Checkout for both payment types  
✅ Customer creation and reuse  
✅ Secure authentication via Supabase  
✅ Opens checkout in new tab  
✅ Push notifications hidden (ready for OneSignal later)

## Production Checklist

Before going live:
1. Switch Stripe to **Live Mode**
2. Update `STRIPE_SECRET_KEY` with your live key (starts with `sk_live_`)
3. Update `PRICE_DEPOSIT` and `PRICE_SUBSCRIPTION` with live price IDs
4. Update `SUCCESS_URL` and `CANCEL_URL` to your production domain
5. Set up webhook with live keys
6. Test with real card in live mode
