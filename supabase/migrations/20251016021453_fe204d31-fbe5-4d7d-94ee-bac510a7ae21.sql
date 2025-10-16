
-- Fix the refresh function to properly refresh the materialized view
CREATE OR REPLACE FUNCTION public.refresh_brand_coverage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Refresh the materialized view concurrently
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_data_coverage;
END;
$function$;

-- Refresh it now
SELECT refresh_brand_coverage();
