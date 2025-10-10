-- Idempotency: prevent duplicate webhook processing
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User-to-customer mapping for reliable webhook processing
CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_customer_id 
ON stripe_customers (stripe_customer_id);

-- Add foreign key to user_billing for data integrity
ALTER TABLE user_billing
ADD CONSTRAINT user_billing_user_fk
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Enable RLS on new tables
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

-- Service role can manage stripe tables
CREATE POLICY "Service role can manage stripe_events"
ON stripe_events FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can manage stripe_customers"
ON stripe_customers FOR ALL
USING (true)
WITH CHECK (true);

-- Users can view their own customer mapping
CREATE POLICY "Users can view own stripe_customers"
ON stripe_customers FOR SELECT
TO authenticated
USING (user_id = auth.uid());