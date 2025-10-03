-- Create fuzzy search function using trigrams
CREATE OR REPLACE FUNCTION public.search_brands_fuzzy(
  search_term text,
  min_similarity float DEFAULT 0.3
)
RETURNS TABLE (
  id uuid,
  name text,
  parent_company text,
  similarity real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.parent_company,
    similarity(LOWER(b.name), LOWER(search_term)) as similarity
  FROM brands b
  WHERE similarity(LOWER(b.name), LOWER(search_term)) > min_similarity
  ORDER BY similarity DESC
  LIMIT 20;
END;
$$;

-- Seed common brand aliases (using brand names to match)
INSERT INTO public.brand_aliases (canonical_brand_id, external_name, source, created_by) 
SELECT 
  b.id,
  alias_name,
  'system_seed',
  NULL
FROM (VALUES
  ('Johnson & Johnson', 'J&J'),
  ('Johnson & Johnson', 'Johnson Johnson'),
  ('Johnson & Johnson', 'JnJ'),
  ('Procter & Gamble', 'P&G'),
  ('Procter & Gamble', 'Procter Gamble'),
  ('Procter & Gamble', 'PG'),
  ('Coca-Cola', 'Coke'),
  ('Coca-Cola', 'Coca Cola'),
  ('PepsiCo', 'Pepsi Co'),
  ('PepsiCo', 'Pepsi'),
  ('General Motors', 'GM'),
  ('General Electric', 'GE'),
  ('Walmart', 'Wal-Mart'),
  ('Walmart', 'Wal Mart'),
  ('Target', 'Target Corp'),
  ('Amazon', 'Amazon.com'),
  ('Microsoft', 'MSFT'),
  ('Apple', 'Apple Inc'),
  ('Google', 'Alphabet'),
  ('Facebook', 'Meta'),
  ('Facebook', 'FB')
) AS aliases(brand_name, alias_name)
LEFT JOIN brands b ON LOWER(b.name) = LOWER(brand_name)
WHERE b.id IS NOT NULL
ON CONFLICT DO NOTHING;

COMMENT ON FUNCTION public.search_brands_fuzzy IS 'Fuzzy search brands using trigram similarity for typo tolerance';