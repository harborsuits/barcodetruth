-- Phase 2 prep: Push subscriptions table for web push notifications
-- This table will store user push subscription endpoints for sending notifications

CREATE TABLE IF NOT EXISTS public.user_push_subs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  ua TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_push_subs ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own push subscriptions"
  ON public.user_push_subs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscriptions
CREATE POLICY "Users can create own push subscriptions"
  ON public.user_push_subs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own subscriptions (unsubscribe)
CREATE POLICY "Users can delete own push subscriptions"
  ON public.user_push_subs
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_push_subs_user_id ON public.user_push_subs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_subs_endpoint ON public.user_push_subs(endpoint);