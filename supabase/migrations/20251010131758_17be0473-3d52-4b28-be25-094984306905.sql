-- Add unique constraint on user_id to prevent duplicate subscriptions
ALTER TABLE user_billing
ADD CONSTRAINT user_billing_user_id_unique UNIQUE (user_id);

-- Add index for faster subscription lookups
CREATE INDEX IF NOT EXISTS idx_user_billing_user_status_period 
ON user_billing (user_id, status, current_period_end);