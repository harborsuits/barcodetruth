-- Create specific function for refreshing coverage materialized view
-- Replaces the dangerous exec_sql() function with a narrowly-scoped operation
CREATE OR REPLACE FUNCTION public.refresh_coverage_materialized_view()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refresh the materialized view concurrently (doesn't lock reads)
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_data_coverage;
END;
$$;

-- Drop the dangerous exec_sql function that allowed arbitrary SQL execution
DROP FUNCTION IF EXISTS public.exec_sql(text);