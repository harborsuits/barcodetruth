-- Deep Scan: Add columns to existing user_scans table and create user_plans

-- Add deep scan fields to existing user_scans table
ALTER TABLE user_scans ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE user_scans ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE user_scans ADD COLUMN IF NOT EXISTS status text CHECK (status IN ('queued','running','success','error'));
ALTER TABLE user_scans ADD COLUMN IF NOT EXISTS result_count int DEFAULT 0;
ALTER TABLE user_scans ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE user_scans ADD COLUMN IF NOT EXISTS dedupe_key text;

-- Update existing rows
UPDATE user_scans SET started_at = scanned_at WHERE started_at IS NULL;
UPDATE user_scans SET status = 'success' WHERE status IS NULL;

-- Now make status NOT NULL with default
ALTER TABLE user_scans ALTER COLUMN status SET DEFAULT 'success';
ALTER TABLE user_scans ALTER COLUMN status SET NOT NULL;

-- User monthly quotas
CREATE TABLE IF NOT EXISTS user_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('free','supporter','pro')),
  scans_per_month int NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS for user_plans
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own plan" ON user_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins read all plans" ON user_plans
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage plans" ON user_plans
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role updates scans" ON user_scans
  FOR UPDATE USING (true);

-- Helper function to get current month usage for deep scans
CREATE OR REPLACE FUNCTION get_scans_used_month(p_user uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*)::int INTO v_count
  FROM user_scans
  WHERE user_id = p_user
    AND date_trunc('month', COALESCE(started_at, scanned_at)) = date_trunc('month', now())
    AND status IN ('running', 'success')
    AND brand_id IS NOT NULL;
  
  RETURN COALESCE(v_count, 0);
END;
$$;

-- Bootstrap default plans on user creation
CREATE OR REPLACE FUNCTION bootstrap_user_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_plans (user_id, plan, scans_per_month)
  VALUES (NEW.id, 'free', 2)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_plan ON auth.users;
CREATE TRIGGER on_auth_user_created_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION bootstrap_user_plan();