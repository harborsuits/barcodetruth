
-- ============================================================
-- Products → Brands Connection - Using barcode everywhere
-- ============================================================

-- 1. NORMALIZE BARCODE FUNCTION
CREATE OR REPLACE FUNCTION public.normalize_barcode(raw text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  digits text := regexp_replace(coalesce(raw,''), '\D', '', 'g');
BEGIN
  IF length(digits) = 12 THEN
    RETURN '0' || digits; -- UPC-A → EAN-13
  ELSE
    RETURN digits;
  END IF;
END;
$$;

-- 2. UNIQUE INDEX on normalized barcode
DROP INDEX IF EXISTS products_barcode_normalized_idx;
CREATE UNIQUE INDEX products_barcode_normalized_idx
ON public.products (public.normalize_barcode(barcode));

-- 3. FAST LOOKUP INDEX for alternatives
CREATE INDEX IF NOT EXISTS products_brand_category_idx
ON public.products (brand_id, category) WHERE brand_id IS NOT NULL;

-- 4. VIEW: product → brand → scores (one-stop lookup)
CREATE OR REPLACE VIEW public.product_brand_profile AS
SELECT
  p.id as product_id,
  p.barcode,
  p.name as product_name,
  p.category,
  b.id as brand_id,
  b.name as brand_name,
  b.logo_url,
  b.parent_company,
  b.description,
  b.website,
  bs.score,
  bs.score_labor,
  bs.score_environment,
  bs.score_politics,
  bs.score_social,
  bs.last_updated
FROM public.products p
LEFT JOIN public.brands b ON b.id = p.brand_id
LEFT JOIN public.brand_scores bs ON bs.brand_id = b.id;

-- 5. VIEW: alternatives (pre-aggregated by category)
CREATE OR REPLACE VIEW public.product_alternatives AS
SELECT
  p.category,
  b.id as brand_id,
  b.name as brand_name,
  b.logo_url,
  ROUND(
    (COALESCE(bs.score_labor, 50) + 
     COALESCE(bs.score_environment, 50) + 
     COALESCE(bs.score_politics, 50) + 
     COALESCE(bs.score_social, 50)) / 4.0
  , 1) as avg_score,
  COUNT(p.id) as product_count
FROM public.products p
JOIN public.brands b ON b.id = p.brand_id
LEFT JOIN public.brand_scores bs ON bs.brand_id = b.id
WHERE p.brand_id IS NOT NULL
GROUP BY p.category, b.id, b.name, b.logo_url, bs.score_labor, bs.score_environment, bs.score_politics, bs.score_social;

-- 6. RPC: Get product by barcode (single lookup)
CREATE OR REPLACE FUNCTION public.get_product_by_barcode(p_raw_gtin text)
RETURNS TABLE (
  product_id uuid,
  gtin text,
  product_name text,
  category text,
  brand_sku text,
  brand_id uuid,
  brand_name text,
  logo_url text,
  parent_company text,
  description text,
  website text,
  score int,
  score_labor int,
  score_environment int,
  score_politics int,
  score_social int,
  last_updated timestamptz
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pbp.product_id,
    pbp.barcode as gtin,
    pbp.product_name,
    pbp.category,
    NULL::text as brand_sku,
    pbp.brand_id,
    pbp.brand_name,
    pbp.logo_url,
    pbp.parent_company,
    pbp.description,
    pbp.website,
    pbp.score,
    pbp.score_labor,
    pbp.score_environment,
    pbp.score_politics,
    pbp.score_social,
    pbp.last_updated
  FROM public.product_brand_profile pbp
  WHERE pbp.barcode = public.normalize_barcode(p_raw_gtin)
  LIMIT 1;
$$;

-- 7. RPC: Get better alternatives (same category, higher scores)
CREATE OR REPLACE FUNCTION public.get_better_alternatives(p_raw_gtin text, p_limit int DEFAULT 3)
RETURNS TABLE (
  brand_id uuid,
  brand_name text,
  logo_url text,
  avg_score numeric,
  product_count bigint
) 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT category, brand_id
    FROM public.products
    WHERE public.normalize_barcode(barcode) = public.normalize_barcode(p_raw_gtin)
    LIMIT 1
  )
  SELECT 
    pa.brand_id, 
    pa.brand_name, 
    pa.logo_url,
    pa.avg_score,
    pa.product_count
  FROM base
  JOIN public.product_alternatives pa USING (category)
  WHERE pa.brand_id <> base.brand_id
  ORDER BY pa.avg_score DESC NULLS LAST
  LIMIT p_limit;
$$;

-- 8. INDEX on user_scans for fast lookups (using barcode column)
CREATE INDEX IF NOT EXISTS user_scans_user_time_idx 
ON public.user_scans(user_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS user_scans_barcode_idx
ON public.user_scans(barcode);
