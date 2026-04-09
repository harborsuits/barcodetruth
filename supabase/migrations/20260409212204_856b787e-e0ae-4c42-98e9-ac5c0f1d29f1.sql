-- Fix get_product_by_barcode: add 3-variant barcode matching
CREATE OR REPLACE FUNCTION public.get_product_by_barcode(p_raw_gtin text)
 RETURNS TABLE(product_id uuid, gtin text, product_name text, category text, brand_sku text, brand_id uuid, brand_name text, logo_url text, parent_company text, description text, website text, score integer, score_labor integer, score_environment integer, score_politics integer, score_social integer, last_updated timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE pbp.barcode IN (
    p_raw_gtin,
    public.normalize_barcode(p_raw_gtin),
    CASE WHEN length(regexp_replace(p_raw_gtin, '\D', '', 'g')) = 13 
         AND regexp_replace(p_raw_gtin, '\D', '', 'g') LIKE '0%'
         THEN substring(regexp_replace(p_raw_gtin, '\D', '', 'g') FROM 2)
         ELSE NULL END
  )
  LIMIT 1;
$function$;

-- Fix scan_product_lookup: add 3-variant barcode matching
CREATE OR REPLACE FUNCTION public.scan_product_lookup(p_upc text)
 RETURNS TABLE(product_id uuid, upc text, product_name text, size text, category text, brand_id uuid, brand_name text, score integer, score_updated timestamp with time zone, events_90d bigint, verified_rate numeric, independent_sources bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  WHERE p.barcode IN (
    p_upc,
    public.normalize_barcode(p_upc),
    CASE WHEN length(regexp_replace(p_upc, '\D', '', 'g')) = 13 
         AND regexp_replace(p_upc, '\D', '', 'g') LIKE '0%'
         THEN substring(regexp_replace(p_upc, '\D', '', 'g') FROM 2)
         ELSE NULL END
  )
  LIMIT 1;
$function$;