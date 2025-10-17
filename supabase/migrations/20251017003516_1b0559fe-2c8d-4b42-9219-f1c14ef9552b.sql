-- Force-clear all Unilever events to test-only for a clean slate
UPDATE public.brand_events 
SET is_test = true
WHERE brand_id = '4965edf9-68f3-4465-88d1-168bc6cc189a';

-- Refresh coverage aggregates if available
DO $$ BEGIN
  PERFORM public.refresh_brand_coverage();
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;