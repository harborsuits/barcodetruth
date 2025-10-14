
-- Create helper function for scan API to avoid complex joins in Edge Function
CREATE OR REPLACE FUNCTION scan_product_lookup(p_upc text)
RETURNS TABLE (
  product_id uuid,
  upc text,
  product_name text,
  size text,
  category text,
  brand_id uuid,
  brand_name text,
  score integer,
  score_updated timestamp with time zone,
  events_90d bigint,
  verified_rate numeric,
  independent_sources bigint
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    p.id AS product_id,
    p.barcode AS upc,
    p.name AS product_name,
    p.category AS size,
    p.category,
    b.id AS brand_id,
    b.name AS brand_name,
    bs.score_labor AS score,
    bs.last_updated AS score_updated,
    COALESCE(bse.events_90d, 0) AS events_90d,
    COALESCE(bse.verified_rate, 0) AS verified_rate,
    COALESCE(bse.independent_sources, 0) AS independent_sources
  FROM products p
  LEFT JOIN brands b ON b.id = p.brand_id
  LEFT JOIN brand_scores bs ON bs.brand_id = b.id
  LEFT JOIN brand_score_effective bse ON bse.brand_id = b.id
  WHERE p.barcode = p_upc
  LIMIT 1;
$$;
