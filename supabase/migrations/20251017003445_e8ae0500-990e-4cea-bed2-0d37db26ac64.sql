-- Phase 0 cleanup: mark Unilever placeholder events as test-only
UPDATE public.brand_events 
SET is_test = true
WHERE brand_id = '4965edf9-68f3-4465-88d1-168bc6cc189a'
  AND (title = 'Untitled event' OR title IS NULL);

-- Helpful partial index for non-test filtering
CREATE INDEX IF NOT EXISTS idx_brand_events_is_test 
ON public.brand_events(brand_id, is_test) 
WHERE is_test = false;

-- Refresh coverage aggregates if helper exists
DO $$ BEGIN
  PERFORM public.refresh_brand_coverage();
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;