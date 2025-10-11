-- Simple scan tracking table
CREATE TABLE IF NOT EXISTS public.user_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  scanned_at timestamp with time zone NOT NULL DEFAULT now(),
  brand_id uuid REFERENCES public.brands(id),
  barcode text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_scans ENABLE ROW LEVEL SECURITY;

-- Users can view their own scans
CREATE POLICY "Users can view own scans"
ON public.user_scans
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own scans
CREATE POLICY "Users can insert own scans"
ON public.user_scans
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Simple index for user lookups
CREATE INDEX IF NOT EXISTS idx_user_scans_user_id ON public.user_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_user_scans_scanned_at ON public.user_scans(scanned_at);

-- Function to check if user can scan
CREATE OR REPLACE FUNCTION public.can_user_scan(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_subscribed boolean;
  scans_this_month int;
  result jsonb;
BEGIN
  -- Check if user has active subscription
  SELECT EXISTS (
    SELECT 1 FROM public.user_billing
    WHERE user_id = p_user_id
      AND status = 'active'
      AND current_period_end > now()
  ) INTO is_subscribed;
  
  -- If subscribed, unlimited scans
  IF is_subscribed THEN
    RETURN jsonb_build_object(
      'can_scan', true,
      'is_subscribed', true,
      'scans_remaining', -1,
      'scans_used', 0
    );
  END IF;
  
  -- Count scans this calendar month
  SELECT COUNT(*) INTO scans_this_month
  FROM public.user_scans
  WHERE user_id = p_user_id
    AND scanned_at >= date_trunc('month', now());
  
  -- Free tier: 5 scans per month
  RETURN jsonb_build_object(
    'can_scan', scans_this_month < 5,
    'is_subscribed', false,
    'scans_remaining', GREATEST(0, 5 - scans_this_month),
    'scans_used', scans_this_month
  );
END;
$$;