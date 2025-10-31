-- Fix staging_products to add created_at timestamp
ALTER TABLE staging_products 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Update merge function to use the correct ordering
CREATE OR REPLACE FUNCTION public.merge_staged_products_batch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merged int := 0;
  v_remaining int := 0;
  v_batch_size int := 200;
BEGIN
  -- Merge staged products into products table
  WITH batch AS (
    SELECT id, barcode, product_name, brand_label, category
    FROM staging_products
    ORDER BY created_at  -- now this column exists
    LIMIT v_batch_size
  ),
  mapped AS (
    SELECT 
      b.barcode,
      b.product_name,
      b.category,
      a.canonical_brand_id as brand_id
    FROM batch b
    LEFT JOIN brand_aliases a ON a.external_name = b.brand_label
  ),
  inserted AS (
    INSERT INTO products (barcode, name, brand_id, category)
    SELECT barcode, product_name, brand_id, category
    FROM mapped
    ON CONFLICT (barcode) DO UPDATE
    SET 
      name = EXCLUDED.name,
      brand_id = EXCLUDED.brand_id,
      category = EXCLUDED.category,
      updated_at = now()
    RETURNING barcode
  ),
  deleted AS (
    DELETE FROM staging_products
    WHERE id IN (SELECT id FROM batch)
    RETURNING id
  )
  SELECT count(*) INTO v_merged FROM deleted;

  -- Count remaining staged products
  SELECT count(*) INTO v_remaining FROM staging_products;

  RETURN jsonb_build_object(
    'merged', v_merged,
    'remaining', v_remaining
  );
END;
$$;