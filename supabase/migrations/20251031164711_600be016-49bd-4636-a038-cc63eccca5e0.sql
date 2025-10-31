-- Fix merge_staged_products_batch: avoid referencing CTE outside its scope
-- Recreate function with counts computed within the same WITH statement
CREATE OR REPLACE FUNCTION public.merge_staged_products_batch(batch_size integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_merged int := 0;
  v_remaining int := 0;
  v_skipped_unmapped int := 0;
  v_skipped_nulls int := 0;
  v_result jsonb;
BEGIN
  WITH candidates AS (
    SELECT
      s.barcode,
      s.product_name AS name,
      s.brand_label,
      s.category,
      s.created_at
    FROM public.staging_products s
    ORDER BY s.created_at
    LIMIT batch_size
  ),
  resolved AS (
    SELECT
      c.barcode,
      c.name,
      COALESCE(ba.canonical_brand_id, br.id) AS brand_id,
      c.category
    FROM candidates c
    LEFT JOIN public.brand_aliases ba
      ON lower(ba.external_name) = lower(c.brand_label)
    LEFT JOIN public.brands br
      ON lower(br.name) = lower(c.brand_label)
  ),
  filtered AS (
    SELECT r.*
    FROM resolved r
    WHERE r.barcode IS NOT NULL
      AND r.name IS NOT NULL
  ),
  mapped AS (
    SELECT * FROM filtered WHERE brand_id IS NOT NULL
  ),
  unmapped AS (
    SELECT * FROM filtered WHERE brand_id IS NULL
  ),
  up AS (
    INSERT INTO public.products (barcode, name, brand_id, category)
    SELECT m.barcode, m.name, m.brand_id, m.category
    FROM mapped m
    ON CONFLICT (barcode) DO UPDATE
      SET name = EXCLUDED.name,
          brand_id = EXCLUDED.brand_id,
          category = EXCLUDED.category,
          updated_at = now()
    RETURNING 1
  ),
  del AS (
    DELETE FROM public.staging_products s
    USING mapped m
    WHERE s.barcode = m.barcode
    RETURNING 1
  ),
  counts AS (
    SELECT
      COALESCE((SELECT count(*) FROM up), 0) AS merged,
      COALESCE((SELECT count(*) FROM unmapped), 0) AS skipped_unmapped,
      COALESCE((SELECT count(*) FROM resolved r WHERE r.barcode IS NULL OR r.name IS NULL), 0) AS skipped_nulls
  )
  SELECT merged, skipped_unmapped, skipped_nulls
  INTO v_merged, v_skipped_unmapped, v_skipped_nulls
  FROM counts;

  -- Remaining in staging after deletions
  SELECT count(*) INTO v_remaining FROM public.staging_products;

  v_result := jsonb_build_object(
    'merged', v_merged,
    'remaining', v_remaining,
    'skipped_unmapped', v_skipped_unmapped,
    'skipped_nulls', v_skipped_nulls
  );

  RETURN v_result;
END;
$function$;