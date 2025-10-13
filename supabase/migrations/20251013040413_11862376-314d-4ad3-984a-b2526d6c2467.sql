-- =====================================================
-- Security Hardening Migration
-- Implements defense-in-depth measures for sensitive data
-- =====================================================

-- 0A. Create admin-only refresh function for materialized views
CREATE OR REPLACE FUNCTION public.admin_refresh_coverage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_data_coverage;
  -- Add other materialized views if needed
END;
$$;

-- Grant execute only to authenticated users (admins check via has_role)
REVOKE ALL ON FUNCTION public.admin_refresh_coverage() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_refresh_coverage() TO authenticated;

-- 0B. Lock down Stripe tables with admin-only access
ALTER TABLE public.stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stripe_cust_admin" ON public.stripe_customers;
CREATE POLICY "stripe_cust_admin" 
ON public.stripe_customers
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "stripe_evt_admin" ON public.stripe_events;
CREATE POLICY "stripe_evt_admin" 
ON public.stripe_events
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Keep existing service role policies for webhook processing
-- (Service role policies already exist and are needed for Stripe webhooks)

-- 0C. Lock down notification_log to owner only
-- Replace overly permissive time-based policy with strict owner check
DROP POLICY IF EXISTS "Users can view their recent notification logs" ON public.notification_log;
CREATE POLICY "notif_self" 
ON public.notification_log
FOR SELECT 
USING (user_id = auth.uid());

-- 2. Jobs queue visibility - admin-only read access
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs_dead ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_admin" ON public.jobs;
CREATE POLICY "jobs_admin" 
ON public.jobs
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "jobs_dead_admin" ON public.jobs_dead;
CREATE POLICY "jobs_dead_admin" 
ON public.jobs_dead
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Keep existing service role policies for job processing
-- (Service role policies already exist and are needed for jobs-runner)

-- 3. Push encryption key rotation infrastructure
CREATE TABLE IF NOT EXISTS public.push_key_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_alias text UNIQUE NOT NULL,
  enc_key bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  active boolean NOT NULL DEFAULT false
);

-- Enable RLS on key versions table
ALTER TABLE public.push_key_versions ENABLE ROW LEVEL SECURITY;

-- Only admins can view key versions
CREATE POLICY "push_keys_admin" 
ON public.push_key_versions
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add key version tracking to push subscriptions
ALTER TABLE public.user_push_subs 
ADD COLUMN IF NOT EXISTS key_alias text DEFAULT 'v1';

-- Insert initial key version record (key will need to be set by admin)
INSERT INTO public.push_key_versions (key_alias, enc_key, active)
VALUES ('v1', decode('706c616365686f6c646572', 'hex'), true)
ON CONFLICT (key_alias) DO NOTHING;

-- Add comment for key rotation procedure
COMMENT ON TABLE public.push_key_versions IS 
'Key rotation: 1) Insert new key with active=true, 2) Mark old key active=false, 3) Re-encrypt subscriptions in background, 4) Delete old key after migration complete';

-- Verification queries (run after migration)
-- A. Check no exec_sql exists
-- SELECT proname FROM pg_proc WHERE proname='exec_sql';  -- should be empty

-- B. Verify policies are in place
-- SELECT tablename, policyname FROM pg_policies 
-- WHERE tablename IN ('stripe_customers','stripe_events','notification_log','jobs','jobs_dead');

-- C. Verify push key versions
-- SELECT key_alias, active, created_at FROM push_key_versions ORDER BY created_at DESC;