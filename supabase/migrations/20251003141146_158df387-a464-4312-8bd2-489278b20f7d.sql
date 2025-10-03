-- Fix: Set search_path on trigger function for security
CREATE OR REPLACE FUNCTION public.tg_set_event_orientation()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cat text := NEW.category::text;
  sev text := COALESCE(NEW.severity::text,'');
  amt numeric := NULLIF((NEW.raw_data->>'penalty_amount')::numeric, NULL);
  recall_class text := COALESCE(NEW.raw_data->>'recall_class','');
BEGIN
  -- Short-circuit if orientation unchanged on update
  IF TG_OP='UPDATE' AND NEW.orientation = OLD.orientation THEN
    RETURN NEW;
  END IF;

  -- Positive signals (awards/certifications/emissions drop, etc.)
  IF cat='environment' AND (NEW.raw_data ? 'certification' OR (NEW.raw_data->>'emissions_change')::numeric < 0) THEN
    NEW.orientation := 'positive';
  ELSIF cat='politics' AND (NEW.raw_data->>'donation_party') ILIKE '%nonpartisan%' THEN
    NEW.orientation := 'neutral';

  -- Typical negatives
  ELSIF cat='labor' AND (amt IS NOT NULL OR sev IN ('moderate','severe','catastrophic')) THEN
    NEW.orientation := 'negative';
  ELSIF cat='environment' AND (sev <> '' OR NEW.raw_data ? 'violation') THEN
    NEW.orientation := 'negative';
  ELSIF cat='social' AND recall_class IN ('I','II','III') THEN
    NEW.orientation := 'negative';
  ELSE
    NEW.orientation := COALESCE(NEW.orientation,'neutral');
  END IF;

  RETURN NEW;
END$$;