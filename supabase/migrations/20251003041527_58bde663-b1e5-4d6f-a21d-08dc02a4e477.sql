-- Update search_brands_fuzzy to explicitly reference pg_trgm functions
CREATE OR REPLACE FUNCTION search_brands_fuzzy(search_term text, min_similarity double precision DEFAULT 0.3)
RETURNS TABLE (
  id uuid,
  name text,
  parent_company text,
  similarity double precision
) 
LANGUAGE plpgsql 
STABLE
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.parent_company,
    extensions.similarity(lower(b.name), lower(search_term))::double precision as similarity
  FROM public.brands b
  WHERE extensions.similarity(lower(b.name), lower(search_term)) > min_similarity
  ORDER BY extensions.similarity(lower(b.name), lower(search_term)) DESC;
END;
$$;