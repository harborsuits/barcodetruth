
DROP FUNCTION IF EXISTS public.get_brand_completeness_metrics();

CREATE FUNCTION public.get_brand_completeness_metrics()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object(
    'total_brands', (SELECT count(*) FROM brands WHERE is_active = true),
    'brands_with_ownership', (SELECT count(DISTINCT brand_id) FROM brand_ownerships),
    'brands_with_evidence', (SELECT count(DISTINCT brand_id) FROM brand_events),
    'brands_with_alternatives', (SELECT count(DISTINCT brand_id) FROM brand_alternatives),
    'brands_with_scores', (SELECT count(*) FROM brand_scores),
    'scan_total', (SELECT count(*) FROM user_scans),
    'scan_resolved', (SELECT count(*) FROM user_scans WHERE brand_id IS NOT NULL),
    'unknown_barcodes_pending', (SELECT count(*) FROM unknown_products WHERE status = 'pending'),
    'brands_with_attributes', (SELECT count(DISTINCT brand_id) FROM brand_attributes),
    'brands_missing_category', (SELECT count(*) FROM brands WHERE is_active = true AND (category_slug IS NULL OR category_slug = '')),
    'brands_missing_attributes', (
      SELECT count(*) FROM brands b 
      WHERE b.is_active = true 
      AND NOT EXISTS (SELECT 1 FROM brand_attributes ba WHERE ba.brand_id = b.id)
    )
  ) INTO result;
  RETURN result;
END;
$$;
