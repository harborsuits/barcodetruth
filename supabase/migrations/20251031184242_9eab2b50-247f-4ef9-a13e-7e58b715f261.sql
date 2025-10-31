-- Fix table name mismatch: product_staging → staging_products
CREATE OR REPLACE FUNCTION public.merge_staged_products_batch(
  batch_size integer DEFAULT 200,
  dry_run boolean DEFAULT false
)
RETURNS TABLE (
  merged integer,
  skipped_unmapped integer,
  remaining integer,
  created_brands integer,
  sample_unmapped text[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_created int := 0;
BEGIN
  -- Create any missing brands (using CORRECT table name: staging_products)
  WITH cand AS (
    SELECT DISTINCT normalize_brand_label(s.brand_label) AS norm
    FROM staging_products s  -- ✅ FIXED: was product_staging
    WHERE COALESCE(s.brand_label, '') <> ''
  ), missing AS (
    SELECT c.norm
    FROM cand c
    LEFT JOIN brands b ON b.norm_name = c.norm
    LEFT JOIN brand_aliases a ON normalize_brand_label(a.external_name) = c.norm
    WHERE b.id IS NULL AND a.id IS NULL AND c.norm <> ''
  ), ins AS (
    INSERT INTO brands(name)
    SELECT initcap(m.norm) FROM missing m
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COALESCE(SUM(1), 0) INTO v_created FROM ins;

  -- Merge products
  RETURN QUERY
  WITH normed AS (
    SELECT s.id, s.barcode, s.product_name,
           normalize_brand_label(s.brand_label) AS norm_brand
    FROM staging_products s  -- ✅ FIXED: was product_staging
    ORDER BY s.id
    LIMIT batch_size
  ),
  resolved AS (
    SELECT n.id, n.barcode, n.product_name, n.norm_brand,
           COALESCE(a.canonical_brand_id, b.id) AS brand_id
    FROM normed n
    LEFT JOIN brand_aliases a ON normalize_brand_label(a.external_name) = n.norm_brand
    LEFT JOIN brands b ON b.norm_name = n.norm_brand
  ),
  to_merge AS (
    SELECT * FROM resolved WHERE brand_id IS NOT NULL
  ),
  unmapped AS (
    SELECT * FROM resolved WHERE brand_id IS NULL
  ),
  upserted AS (
    INSERT INTO products (barcode, name, brand_id)
    SELECT t.barcode, t.product_name, t.brand_id
    FROM to_merge t
    WHERE NOT dry_run
    ON CONFLICT (barcode) DO UPDATE
      SET name = EXCLUDED.name,
          brand_id = EXCLUDED.brand_id
    RETURNING 1
  ),
  deleted_staging AS (
    DELETE FROM staging_products  -- ✅ FIXED: was product_staging
    WHERE id IN (SELECT id FROM to_merge)
      AND NOT dry_run
    RETURNING 1
  )
  SELECT
    (SELECT COUNT(*)::int FROM to_merge) AS merged,
    (SELECT COUNT(*)::int FROM unmapped) AS skipped_unmapped,
    GREATEST((SELECT COUNT(*)::int FROM staging_products) - batch_size, 0) AS remaining,  -- ✅ FIXED
    v_created AS created_brands,
    (SELECT ARRAY_AGG(DISTINCT u.norm_brand)
       FROM (SELECT norm_brand FROM unmapped LIMIT 10) u) AS sample_unmapped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_staged_products_batch(integer, boolean)
  TO anon, authenticated, service_role;