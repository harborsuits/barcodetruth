-- Safety precheck: ensure pgcrypto and unique constraint on staging_products
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add unique constraint on content_hash if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'staging_products_content_hash_key'
    AND conrelid = 'staging_products'::regclass
  ) THEN
    ALTER TABLE staging_products
      ADD CONSTRAINT staging_products_content_hash_key UNIQUE(content_hash);
  END IF;
END$$;

-- Drop and recreate merge_staged_products_batch to fix brand mapping
DROP FUNCTION IF EXISTS public.merge_staged_products_batch();

CREATE OR REPLACE FUNCTION public.merge_staged_products_batch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merged int := 0;
  v_remaining int := 0;
BEGIN
  -- Take up to 200 rows from staging
  WITH batch AS (
    SELECT * FROM staging_products
    ORDER BY created_at ASC
    LIMIT 200
  ),
  -- Normalize barcodes and map brands via aliases
  normalized_batch AS (
    SELECT 
      normalize_barcode(b.barcode) AS barcode,
      b.product_name,
      b.brand_label,
      b.category,
      b.content_hash,
      ba.canonical_brand_id
    FROM batch b
    LEFT JOIN brand_aliases ba ON ba.external_name = b.brand_label
    WHERE LENGTH(REGEXP_REPLACE(b.barcode, '[^0-9]', '', 'g')) BETWEEN 8 AND 14
  ),
  -- Deduplicate by normalized barcode (first occurrence wins)
  deduped AS (
    SELECT DISTINCT ON (barcode) *
    FROM normalized_batch
  ),
  -- UPSERT products (idempotent on barcode)
  upserted AS (
    INSERT INTO public.products (barcode, name, brand_id, category)
    SELECT 
      d.barcode,
      COALESCE(d.product_name, d.brand_label, d.barcode) AS name,
      d.canonical_brand_id,
      d.category
    FROM deduped d
    ON CONFLICT (barcode) DO UPDATE SET
      name = COALESCE(EXCLUDED.name, products.name),
      brand_id = COALESCE(EXCLUDED.brand_id, products.brand_id),
      category = COALESCE(EXCLUDED.category, products.category),
      updated_at = NOW()
    RETURNING barcode
  ),
  -- Delete processed rows from staging
  deleted AS (
    DELETE FROM staging_products
    WHERE content_hash IN (SELECT content_hash FROM deduped)
    RETURNING id
  )
  SELECT COUNT(*) INTO v_merged FROM deleted;
  SELECT COUNT(*) INTO v_remaining FROM staging_products;
  
  RETURN jsonb_build_object(
    'merged', v_merged,
    'remaining', v_remaining
  );
END;
$$;