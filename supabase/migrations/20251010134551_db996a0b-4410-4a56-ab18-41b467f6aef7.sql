-- Ensure updated_at default
ALTER TABLE user_billing
  ALTER COLUMN updated_at SET DEFAULT now();

-- Create lookups to map from Stripe events
CREATE UNIQUE INDEX IF NOT EXISTS user_billing_customer_uidx ON user_billing (stripe_customer_id);
CREATE INDEX IF NOT EXISTS user_billing_subscription_idx ON user_billing (stripe_subscription_id);

-- Ensure RLS is enabled
ALTER TABLE user_billing ENABLE ROW LEVEL SECURITY;

-- Create read policy if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public'
    AND tablename = 'user_billing' 
    AND policyname = 'read_own_billing'
  ) THEN
    CREATE POLICY "read_own_billing"
    ON user_billing FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());
  END IF;
END $$;