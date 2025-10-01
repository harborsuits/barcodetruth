-- Drop and recreate rate limiter with explicit user_id parameter
DROP FUNCTION IF EXISTS public.allow_push_send(text, text);
DROP FUNCTION IF EXISTS public.allow_push_send(uuid, text, text);

-- Add generated day column for fast lookups
ALTER TABLE public.notification_log
  ADD COLUMN IF NOT EXISTS sent_day date
  GENERATED ALWAYS AS ((sent_at AT TIME ZONE 'UTC')::date) STORED;

-- Create optimized index
CREATE INDEX IF NOT EXISTS idx_notiflog_user_brand_day
  ON public.notification_log(user_id, brand_id, sent_day)
  WHERE success = true;

-- Recreate rate limiter with explicit user_id parameter (for service role context)
CREATE OR REPLACE FUNCTION public.allow_push_send(
  p_user_id uuid,
  p_brand text,
  p_category text
)
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
    AND success = true
    AND sent_day = CURRENT_DATE;

  IF count_today >= 2 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;