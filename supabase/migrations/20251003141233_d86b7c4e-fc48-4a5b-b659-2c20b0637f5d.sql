-- Fix: Update trigger to use correct enum values (mixed instead of neutral)
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
  IF TG_OP='UPDATE' AND NEW.orientation IS NOT NULL AND NEW.orientation = OLD.orientation THEN
    RETURN NEW;
  END IF;

  -- Positive signals (awards/certifications/emissions drop, etc.)
  IF cat='environment' AND (NEW.raw_data ? 'certification' OR (NEW.raw_data->>'emissions_change')::numeric < 0) THEN
    NEW.orientation := 'positive';
  ELSIF cat='politics' AND (NEW.raw_data->>'donation_party') ILIKE '%nonpartisan%' THEN
    NEW.orientation := 'mixed';

  -- Typical negatives
  ELSIF cat='labor' AND (amt IS NOT NULL OR sev IN ('moderate','severe','catastrophic')) THEN
    NEW.orientation := 'negative';
  ELSIF cat='environment' AND (sev <> '' OR NEW.raw_data ? 'violation') THEN
    NEW.orientation := 'negative';
  ELSIF cat='social' AND recall_class IN ('I','II','III') THEN
    NEW.orientation := 'negative';
  ELSE
    NEW.orientation := COALESCE(NEW.orientation, 'mixed');
  END IF;

  RETURN NEW;
END$$;

-- Update constraint to use correct enum values
ALTER TABLE public.brand_events DROP CONSTRAINT IF EXISTS chk_orientation;
ALTER TABLE public.brand_events
ADD CONSTRAINT chk_orientation
CHECK (orientation::text IN ('positive','negative','mixed'));

-- Backfill orientations with correct enum values
UPDATE public.brand_events
SET orientation = CASE
  -- Environment negatives
  WHEN category = 'environment' AND (severity IS NOT NULL OR raw_data ? 'violation') THEN 'negative'::event_orientation
  -- Labor negatives  
  WHEN category = 'labor' AND (severity IS NOT NULL OR (raw_data->>'penalty_amount')::numeric IS NOT NULL) THEN 'negative'::event_orientation
  -- Social negatives (recalls)
  WHEN category = 'social' AND (raw_data->>'recall_class') IN ('I','II','III') THEN 'negative'::event_orientation
  -- Politics - default to negative (donations)
  WHEN category = 'politics' THEN 'negative'::event_orientation
  -- Default to mixed (neither clearly positive nor negative)
  ELSE 'mixed'::event_orientation
END
WHERE orientation IS NULL;