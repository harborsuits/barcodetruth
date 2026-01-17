-- Function to reset brands stuck in "building" status for more than 10 minutes
CREATE OR REPLACE FUNCTION public.reset_stale_building_brands()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reset_count INTEGER;
BEGIN
  WITH stale_brands AS (
    UPDATE brands
    SET 
      status = 'stub',
      enrichment_stage = NULL,
      enrichment_stage_updated_at = NULL,
      next_enrichment_at = now() + interval '1 minute',
      enrichment_error = 'Reset: stuck in building for >10 minutes',
      updated_at = now()
    WHERE status = 'building'
      AND enrichment_stage_updated_at < now() - interval '10 minutes'
    RETURNING id
  )
  SELECT COUNT(*) INTO reset_count FROM stale_brands;
  
  IF reset_count > 0 THEN
    RAISE LOG 'reset_stale_building_brands: reset % stale brands', reset_count;
  END IF;
  
  RETURN reset_count;
END;
$$;

-- Grant execute to service role for cron job
GRANT EXECUTE ON FUNCTION public.reset_stale_building_brands() TO service_role;