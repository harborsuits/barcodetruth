-- Search only published products and active brands with ready profiles.
CREATE OR REPLACE FUNCTION public.search_catalog(p_q text, p_limit integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  result jsonb;
  q_norm text := public.unaccent(lower(left(trim(coalesce(p_q, '')), 200)));
  row_limit integer := greatest(0, least(coalesce(p_limit, 20), 50));
BEGIN
  IF q_norm = '' OR row_limit = 0 THEN
    RETURN jsonb_build_object('products', '[]'::jsonb, 'brands', '[]'::jsonb);
  END IF;
  WITH product_matches AS (
    SELECT p.id, p.name, p.category, p.brand_id, p.barcode,
      similarity(public.unaccent(lower(p.name)), q_norm) AS sim
    FROM public.products p
    WHERE p.review_status = 'approved'
      AND (position(q_norm in public.unaccent(lower(p.name))) > 0
        OR (length(q_norm) >= 3 AND similarity(public.unaccent(lower(p.name)), q_norm) > 0.3))
    ORDER BY sim DESC, p.name, p.id LIMIT row_limit
  ), brand_matches AS (
    SELECT b.id, b.name, b.parent_company,
      similarity(public.unaccent(lower(b.name)), q_norm) AS sim
    FROM public.brands b
    WHERE b.is_active = true AND b.status IN ('ready', 'active') AND coalesce(b.is_test, false) = false
      AND (position(q_norm in public.unaccent(lower(b.name))) > 0
        OR (length(q_norm) >= 3 AND similarity(public.unaccent(lower(b.name)), q_norm) > 0.3))
    ORDER BY sim DESC, b.name, b.id LIMIT row_limit
  )
  SELECT jsonb_build_object(
    'products', coalesce((SELECT jsonb_agg(to_jsonb(pm.*)) FROM product_matches pm), '[]'::jsonb),
    'brands', coalesce((SELECT jsonb_agg(to_jsonb(bm.*)) FROM brand_matches bm), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$function$;
