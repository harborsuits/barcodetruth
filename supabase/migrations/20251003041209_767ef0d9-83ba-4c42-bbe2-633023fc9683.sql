-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index on brands.name for faster fuzzy searches
CREATE INDEX IF NOT EXISTS brands_name_trgm_idx ON brands USING gin (name gin_trgm_ops);

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS search_brands_fuzzy(text, double precision);

-- Create fuzzy search function for brands
CREATE OR REPLACE FUNCTION search_brands_fuzzy(search_term text, min_similarity float DEFAULT 0.3)
RETURNS TABLE (
  id uuid,
  name text,
  parent_company text,
  similarity float
) AS $$
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
$$ LANGUAGE plpgsql STABLE;