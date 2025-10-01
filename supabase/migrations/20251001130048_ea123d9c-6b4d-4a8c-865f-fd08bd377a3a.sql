-- notification log table for rate limiting and tracking
CREATE TABLE IF NOT EXISTS public.notification_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  brand_id text NOT NULL,
  category text NOT NULL,
  delta int,
  success boolean DEFAULT true,
  error text,
  sent_at timestamptz DEFAULT now()
);

-- Simple index for user + brand lookups (date_trunc can't be in index)
CREATE INDEX IF NOT EXISTS idx_notification_log_user_brand 
  ON public.notification_log(user_id, brand_id, sent_at DESC);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification logs
CREATE POLICY "Users can view own notification logs"
  ON public.notification_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert notification logs
CREATE POLICY "Service role can insert notification logs"
  ON public.notification_log
  FOR INSERT
  WITH CHECK (true);

-- Rate limiter function: max 2 notifications per brand per user per day
CREATE OR REPLACE FUNCTION public.allow_push_send(p_user_id uuid, p_brand text, p_category text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count_today int;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT count(*) INTO count_today
  FROM public.notification_log
  WHERE user_id = p_user_id
    AND brand_id = p_brand
    AND sent_at >= date_trunc('day', now() AT TIME ZONE 'UTC')
    AND success = true;

  IF count_today >= 2 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;