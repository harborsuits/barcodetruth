-- Create user_billing table for reliable Stripe customer mapping
CREATE TABLE IF NOT EXISTS public.user_billing (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text UNIQUE NOT NULL,
  stripe_subscription_id text,
  status text,
  product_id text,
  current_period_end timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_billing_customer_idx ON public.user_billing(stripe_customer_id);

-- Enable RLS
ALTER TABLE public.user_billing ENABLE ROW LEVEL SECURITY;

-- Users can only view their own billing info
CREATE POLICY "Users can view own billing"
  ON public.user_billing
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all billing records (for webhook)
CREATE POLICY "Service role can manage billing"
  ON public.user_billing
  FOR ALL
  USING (true)
  WITH CHECK (true);