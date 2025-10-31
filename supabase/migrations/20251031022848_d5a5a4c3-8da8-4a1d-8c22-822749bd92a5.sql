-- Drop and recreate merge_staged_products_batch with UPSERT for idempotency
DROP FUNCTION IF EXISTS public.merge_staged_products_batch();

CREATE OR REPLACE FUNCTION public.merge_staged_products_batch()
RETURNS TABLE(merged bigint, remaining bigint) AS $$
DECLARE
  v_merged bigint := 0;
  v_remaining bigint := 0;
BEGIN
  -- Take up to 200 rows from staging
  WITH batch AS (
    SELECT * FROM staging_products
    ORDER BY created_at ASC
    LIMIT 200
  ),
  -- Normalize barcodes and filter valid ones
  normalized_batch AS (
    SELECT 
      normalize_barcode(barcode) AS barcode,
      product_name,
      brand_label,
      category,
      content_hash
    FROM batch
    WHERE LENGTH(REGEXP_REPLACE(barcode, '[^0-9]', '', 'g')) BETWEEN 8 AND 14
  ),
  -- Deduplicate by normalized barcode (first occurrence wins)
  deduped AS (
    SELECT DISTINCT ON (barcode) *
    FROM normalized_batch
  ),
  -- UPSERT products (idempotent on barcode)
  upserted AS (
    INSERT INTO public.products (barcode, name, brand, category)
    SELECT 
      d.barcode,
      COALESCE(d.product_name, d.brand_label, d.barcode) AS name,
      d.brand_label,
      d.category
    FROM deduped d
    ON CONFLICT (barcode) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, products.name),
      brand = COALESCE(EXCLUDED.brand, products.brand),
      category = COALESCE(EXCLUDED.category, products.category),
      updated_at = NOW()
    RETURNING barcode
  ),
  -- Enqueue brands for enrichment
  enqueued AS (
    INSERT INTO public.enrichment_queue (brand_name, priority, source)
    SELECT DISTINCT 
      d.brand_label,
      3,
      'product-seed'
    FROM deduped d
    WHERE d.brand_label IS NOT NULL
    ON CONFLICT (brand_name) DO NOTHING
    RETURNING brand_name
  ),
  -- Delete processed rows from staging
  deleted AS (
    DELETE FROM staging_products
    WHERE content_hash IN (SELECT content_hash FROM deduped)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_merged FROM deleted;
  SELECT COUNT(*) INTO v_remaining FROM staging_products;
  
  RETURN QUERY SELECT v_merged, v_remaining;
END;
$$ LANGUAGE plpgsql;