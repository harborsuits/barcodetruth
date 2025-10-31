-- Fix merge_staged_products_batch to skip products with NULL names
CREATE OR REPLACE FUNCTION public.merge_staged_products_batch(batch_size INT DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_merged INT := 0;
  v_remaining INT := 0;
BEGIN
  -- Insert from staging where product_name IS NOT NULL
  WITH to_merge AS (
    SELECT 
      sp.id,
      sp.barcode,
      sp.product_name,
      sp.category,
      sp.brand_label,
      ba.canonical_brand_id,
      sp.upc_type,
      sp.valid_checksum
    FROM staging_products sp
    LEFT JOIN brand_aliases ba ON LOWER(TRIM(sp.brand_label)) = LOWER(ba.external_name)
    WHERE sp.product_name IS NOT NULL  -- Skip NULL names
    ORDER BY sp.created_at
    LIMIT batch_size
  ),
  inserted AS (
    INSERT INTO products (barcode, name, category, brand_id, upc_type, valid_checksum, source)
    SELECT 
      tm.barcode,
      tm.product_name,
      tm.category,
      tm.canonical_brand_id,
      tm.upc_type,
      tm.valid_checksum,
      'manual'
    FROM to_merge tm
    ON CONFLICT (barcode) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      brand_id = EXCLUDED.brand_id,
      upc_type = EXCLUDED.upc_type,
      valid_checksum = EXCLUDED.valid_checksum,
      updated_at = now()
    RETURNING id
  ),
  deleted AS (
    DELETE FROM staging_products
    WHERE id IN (SELECT id FROM to_merge)
    RETURNING id
  )
  SELECT 
    (SELECT COUNT(*) FROM inserted) INTO v_merged;

  SELECT COUNT(*) INTO v_remaining FROM staging_products;

  RETURN jsonb_build_object(
    'merged', v_merged,
    'remaining', v_remaining
  );
END;
$$;