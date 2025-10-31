-- Fix merge function to use normalized barcodes for filtering and deduplication
-- Prevents batches from skipping rows when raw barcodes contain spaces/dashes
-- Also deletes only rows that were actually processed

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
  -- Take up to 200 rows with non-empty product names (to satisfy products.name NOT NULL)
  WITH next_batch AS (
    SELECT *
    FROM staging_products
    WHERE product_name IS NOT NULL AND trim(product_name) <> ''
    ORDER BY inserted_at
    LIMIT 200
  ),
  -- Normalize barcodes first, then filter to valid digit lengths, and dedupe per normalized barcode
  deduped AS (
    SELECT DISTINCT ON (normalize_barcode(nb.barcode))
      nb.id,
      normalize_barcode(nb.barcode) AS barcode,
      trim(nb.product_name) AS product_name,
      nb.brand_label,
      NULLIF(nb.category, '') AS category,
      nb.inserted_at
    FROM next_batch nb
    WHERE normalize_barcode(nb.barcode) ~ '^\d{8,14}$'
    ORDER BY normalize_barcode(nb.barcode), nb.inserted_at DESC
  ),
  inserted AS (
    INSERT INTO public.products (barcode, name, brand_id, category)
    SELECT
      d.barcode,
      d.product_name AS name,
      COALESCE(
        (SELECT canonical_brand_id FROM brand_aliases WHERE external_name ILIKE d.brand_label LIMIT 1),
        (SELECT id FROM brands WHERE name ILIKE d.brand_label LIMIT 1)
      ) AS brand_id,
      d.category
    FROM deduped d
    ON CONFLICT (barcode) DO UPDATE
    SET
      name = COALESCE(EXCLUDED.name, products.name),
      brand_id = COALESCE(EXCLUDED.brand_id, products.brand_id),
      category = COALESCE(EXCLUDED.category, products.category)
    RETURNING 1
  ),
  enqueued AS (
    INSERT INTO brand_enrichment_queue (brand_id, task)
    SELECT DISTINCT p.brand_id, 'full'::text
    FROM products p
    JOIN deduped d ON d.barcode = p.barcode
    WHERE p.brand_id IS NOT NULL
    ON CONFLICT DO NOTHING
    RETURNING 1
  ),
  deleted AS (
    DELETE FROM staging_products
    WHERE id IN (SELECT id FROM deduped)
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_merged FROM inserted;

  SELECT COUNT(*) INTO v_remaining FROM staging_products;

  RETURN jsonb_build_object(
    'merged', v_merged,
    'remaining', v_remaining
  );
END;
$$;