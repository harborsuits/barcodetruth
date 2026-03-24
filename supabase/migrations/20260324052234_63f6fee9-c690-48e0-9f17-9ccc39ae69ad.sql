CREATE OR REPLACE FUNCTION public.search_catalog(p_q text, p_limit integer DEFAULT 20)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  result jsonb;
BEGIN
  WITH product_matches AS (
    SELECT 
      p.id,
      p.name,
      p.category,
      p.brand_id,
      p.barcode,
      similarity(p.name, p_q) as sim
    FROM products p
    WHERE (length(p_q) < 3 AND p.name ILIKE p_q || '%')
       OR (length(p_q) >= 3 AND (p.name ILIKE '%' || p_q || '%' OR similarity(p.name, p_q) > 0.3))
    ORDER BY sim DESC, p.name
    LIMIT p_limit
  ),
  brand_matches AS (
    SELECT 
      b.id,
      b.name,
      b.parent_company,
      similarity(b.name, p_q) as sim
    FROM brands b
    WHERE b.status = 'active'
      AND ((length(p_q) < 3 AND b.name ILIKE p_q || '%')
       OR (length(p_q) >= 3 AND (b.name ILIKE '%' || p_q || '%' OR similarity(b.name, p_q) > 0.3)))
    ORDER BY sim DESC, b.name
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'products', COALESCE((SELECT jsonb_agg(to_jsonb(pm.*)) FROM product_matches pm), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(to_jsonb(bm.*)) FROM brand_matches bm), '[]'::jsonb)
  ) INTO result;
  
  RETURN result;
END;
$function$;