-- Update search_catalog to add length check for better performance
CREATE OR REPLACE FUNCTION search_catalog(p_q text, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH product_matches AS (
    SELECT 
      id,
      name,
      category,
      brand_id,
      barcode,
      similarity(name, p_q) as sim
    FROM products
    WHERE (name ILIKE '%' || p_q || '%')
       OR (length(p_q) >= 3 AND similarity(name, p_q) > 0.3)
    ORDER BY sim DESC, name
    LIMIT p_limit
  ),
  brand_matches AS (
    SELECT 
      id,
      name,
      parent_company,
      similarity(name, p_q) as sim
    FROM brands
    WHERE (name ILIKE '%' || p_q || '%')
       OR (length(p_q) >= 3 AND similarity(name, p_q) > 0.3)
    ORDER BY sim DESC, name
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'products', COALESCE((SELECT jsonb_agg(to_jsonb(pm.*)) FROM product_matches pm), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(to_jsonb(bm.*)) FROM brand_matches bm), '[]'::jsonb)
  ) INTO result;
  
  RETURN result;
END;
$$;