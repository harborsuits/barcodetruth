-- Create user_plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','supporter','pro')),
  scans_per_month int NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users read own plan" ON user_plans;
DROP POLICY IF EXISTS "Admins read all plans" ON user_plans;
DROP POLICY IF EXISTS "Admins manage plans" ON user_plans;

-- Create policies
CREATE POLICY "Users read own plan" ON user_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert plans" ON user_plans
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can update plans" ON user_plans
  FOR UPDATE USING (true);

-- Create trigger function to auto-create plan on signup
CREATE OR REPLACE FUNCTION bootstrap_user_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_plans (user_id, plan, scans_per_month)
  VALUES (NEW.id, 'free', 5)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created_plan ON auth.users;
CREATE TRIGGER on_auth_user_created_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION bootstrap_user_plan();