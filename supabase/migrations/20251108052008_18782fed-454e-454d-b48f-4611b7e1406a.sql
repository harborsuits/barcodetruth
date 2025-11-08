
-- Fix barcode normalization in get_product_by_barcode RPC
-- The issue: normalize_barcode adds leading zero (UPC→EAN13) but our DB stores UPC-A
-- Solution: Compare both raw and normalized barcodes

CREATE OR REPLACE FUNCTION public.get_product_by_barcode(p_raw_gtin text)
RETURNS TABLE(
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
  score integer, 
  score_labor integer, 
  score_environment integer, 
  score_politics integer, 
  score_social integer, 
  last_updated timestamp with time zone
)
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path TO 'public'
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
  WHERE pbp.barcode = p_raw_gtin 
     OR pbp.barcode = public.normalize_barcode(p_raw_gtin)
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_product_by_barcode IS 'Fixed: Now matches both raw and normalized barcodes to handle UPC-A (12) and EAN-13 (13) formats';
