-- Fix search_path for search_brands_fuzzy function
CREATE OR REPLACE FUNCTION search_brands_fuzzy(search_term text, min_similarity float DEFAULT 0.3)
RETURNS TABLE (
  id uuid,
  name text,
  parent_company text,
  similarity float
) 
LANGUAGE plpgsql 
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.parent_company,
    similarity(lower(b.name), lower(search_term)) as similarity
  FROM brands b
  WHERE similarity(lower(b.name), lower(search_term)) > min_similarity
  ORDER BY similarity DESC;
END;
$$;