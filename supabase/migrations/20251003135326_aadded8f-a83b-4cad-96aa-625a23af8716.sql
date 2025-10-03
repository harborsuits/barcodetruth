-- ============================================================================
-- SECURITY HARDENING MIGRATION
-- Addresses: SUPA_security_definer_view, PUBLIC_USER_DATA, 
--            MISSING_RLS_PROTECTION, EXPOSED_SENSITIVE_DATA
-- ============================================================================

-- 1) Convert views to security_invoker (caller's privileges, not owner's)
-- ============================================================================
ALTER VIEW IF EXISTS public.v_brand_sources_inline SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_parent_rollups SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_baseline_inputs_24m SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_baseline_inputs_90d SET (security_invoker = true);
ALTER VIEW IF EXISTS public.brand_evidence_view SET (security_invoker = true);
ALTER VIEW IF EXISTS public.brand_evidence_independent SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_coalescing_effectiveness SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_notification_metrics_hourly SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_notification_usage_today SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_rate_limit_pressure SET (security_invoker = true);

-- 2) Harden user_push_subs table
-- ============================================================================
ALTER TABLE public.user_push_subs ENABLE ROW LEVEL SECURITY;

-- Remove overly permissive grants
REVOKE ALL ON public.user_push_subs FROM PUBLIC;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Users can create own push subscriptions" ON public.user_push_subs;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.user_push_subs;
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.user_push_subs;
DROP POLICY IF EXISTS user_push_subs_select ON public.user_push_subs;
DROP POLICY IF EXISTS user_push_subs_ins ON public.user_push_subs;
DROP POLICY IF EXISTS user_push_subs_upd ON public.user_push_subs;
DROP POLICY IF EXISTS user_push_subs_del ON public.user_push_subs;

-- Create strict owner-only policies
CREATE POLICY user_push_subs_select ON public.user_push_subs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_push_subs_ins ON public.user_push_subs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_push_subs_upd ON public.user_push_subs
  FOR UPDATE USING (auth.uid() = user_id)
             WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_push_subs_del ON public.user_push_subs
  FOR DELETE USING (auth.uid() = user_id);

-- Prevent duplicate subscriptions
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_push_subs_user_endpoint
ON public.user_push_subs (user_id, endpoint);

-- 3) Harden notification_log table
-- ============================================================================
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Ensure user_id is not nullable and has FK
ALTER TABLE public.notification_log
  ALTER COLUMN user_id SET NOT NULL;

-- Add FK if not exists (idempotent check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notification_log_user'
  ) THEN
    ALTER TABLE public.notification_log
      ADD CONSTRAINT fk_notification_log_user
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Service role can insert notification logs" ON public.notification_log;
DROP POLICY IF EXISTS "Users can view own notification logs" ON public.notification_log;
DROP POLICY IF EXISTS notification_log_select ON public.notification_log;
DROP POLICY IF EXISTS notification_log_insert ON public.notification_log;

-- Strict read-only for users; server-side writes only
CREATE POLICY notification_log_select ON public.notification_log
  FOR SELECT USING (auth.uid() = user_id);

-- Create safe server-side insert function
CREATE OR REPLACE FUNCTION public.log_notification(
  p_user_id uuid,
  p_brand_id text,
  p_category text,
  p_delta integer DEFAULT NULL,
  p_success boolean DEFAULT true,
  p_error text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate user exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Unknown user';
  END IF;

  -- Insert notification log
  INSERT INTO public.notification_log(
    user_id, brand_id, category, delta, success, error, sent_at, sent_day
  ) VALUES (
    p_user_id, p_brand_id, p_category, p_delta, p_success, p_error, 
    now(), CURRENT_DATE
  );
END;
$$;

-- 4) Harden user_preferences table
-- ============================================================================
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Remove public grants
REVOKE ALL ON public.user_preferences FROM PUBLIC;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can insert own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can view own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS user_prefs_select ON public.user_preferences;
DROP POLICY IF EXISTS user_prefs_ins ON public.user_preferences;
DROP POLICY IF EXISTS user_prefs_upd ON public.user_preferences;

-- Strict owner-only policies
CREATE POLICY user_prefs_select ON public.user_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY user_prefs_ins ON public.user_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_prefs_upd ON public.user_preferences
  FOR UPDATE USING (auth.uid() = user_id)
             WITH CHECK (auth.uid() = user_id);

-- Create safe public view (excludes sensitive political_alignment)
CREATE OR REPLACE VIEW public.v_user_preferences_safe AS
SELECT user_id, muted_categories, notification_mode, digest_time, 
       exclude_same_parent, updated_at, created_at
FROM public.user_preferences;

ALTER VIEW public.v_user_preferences_safe SET (security_invoker = true);

-- 5) Harden user_follows table
-- ============================================================================
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.user_follows FROM PUBLIC;

-- Policies should already be correct, but ensure they're strict
DROP POLICY IF EXISTS "Users can delete own follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can insert own follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can update own follows" ON public.user_follows;
DROP POLICY IF EXISTS "Users can view own follows" ON public.user_follows;

CREATE POLICY "Users can view own follows" ON public.user_follows
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own follows" ON public.user_follows
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own follows" ON public.user_follows
  FOR UPDATE USING (auth.uid() = user_id)
             WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own follows" ON public.user_follows
  FOR DELETE USING (auth.uid() = user_id);

-- Grant execute on safe functions to authenticated users
GRANT EXECUTE ON FUNCTION public.log_notification TO authenticated;
GRANT SELECT ON public.v_user_preferences_safe TO authenticated;