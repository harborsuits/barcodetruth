-- Fix search_path for security definer functions
CREATE OR REPLACE FUNCTION update_brand_scores_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION get_source_credibility(source_name_param TEXT)
RETURNS DECIMAL(3,2)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  credibility DECIMAL(3,2);
BEGIN
  SELECT COALESCE(base_credibility + dynamic_adjustment, 0.50)
  INTO credibility
  FROM source_credibility
  WHERE source_name = source_name_param;
  
  IF credibility IS NULL THEN
    credibility := 0.50;
  END IF;
  
  RETURN credibility;
END;
$$;

-- Move extensions from public to extensions schema (if not already there)
-- Note: Extensions are typically managed by Supabase, but we ensure proper schema
-- uuid-ossp and pg_trgm are standard and should be in the extensions schema by default