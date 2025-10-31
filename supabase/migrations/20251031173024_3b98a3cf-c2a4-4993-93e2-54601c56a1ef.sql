-- Enable unaccent extension for accent-insensitive matching
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create helper function for brand normalization (strips accents, xx:, separators)
CREATE OR REPLACE FUNCTION normalize_brand_label(txt text)
RETURNS text
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        lower(unaccent(coalesce(txt, ''))),
        '^\s*xx:\s*', ''
      ),
      '[-_&]+', ' ', 'g'
    )
  )
$$;

-- Recreate merge RPC using the new normalization function
DROP FUNCTION IF EXISTS public.merge_staged_products_batch(integer);

CREATE OR REPLACE FUNCTION public.merge_staged_products_batch(batch_size integer DEFAULT 200)
RETURNS TABLE(merged int, remaining int, skipped_unmapped int, skipped_nulls int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_merged int := 0;
  v_remaining int := 0;
  v_skipped_unmapped int := 0;
  v_skipped_nulls int := 0;
BEGIN
  WITH candidates AS (
    SELECT
      s.barcode,
      s.product_name AS name,
      s.category,
      normalize_brand_label(s.brand_label) AS normalized_label
    FROM public.staging_products s
    WHERE s.brand_label IS NOT NULL
    ORDER BY s.created_at
    LIMIT batch_size
  ),
  resolved AS (
    SELECT
      c.barcode,
      c.name,
      c.category,
      COALESCE(
        ba.canonical_brand_id,
        br.id
      ) AS brand_id
    FROM candidates c
    LEFT JOIN public.brand_aliases ba
      ON normalize_brand_label(ba.external_name) = c.normalized_label
    LEFT JOIN public.brands br
      ON normalize_brand_label(br.name) = c.normalized_label
  ),
  filtered AS (
    SELECT * FROM resolved WHERE barcode IS NOT NULL AND name IS NOT NULL
  ),
  mapped AS (
    SELECT * FROM filtered WHERE brand_id IS NOT NULL
  ),
  unmapped AS (
    SELECT * FROM filtered WHERE brand_id IS NULL
  ),
  ups AS (
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
  dels AS (
    DELETE FROM public.staging_products s
    USING mapped m
    WHERE s.barcode = m.barcode
    RETURNING 1
  )
  SELECT
    COALESCE((SELECT count(*)::int FROM ups), 0),
    COALESCE((SELECT count(*)::int FROM unmapped), 0),
    COALESCE((SELECT count(*)::int FROM candidates WHERE barcode IS NULL OR name IS NULL), 0)
  INTO v_merged, v_skipped_unmapped, v_skipped_nulls;

  SELECT count(*)::int INTO v_remaining FROM public.staging_products;

  RETURN QUERY SELECT v_merged, v_remaining, v_skipped_unmapped, v_skipped_nulls;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_staged_products_batch(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.merge_staged_products_batch(integer) TO authenticated;

-- Create top missing brands from staging data (using WHERE NOT EXISTS to avoid duplicates)
INSERT INTO brands (name, is_active, created_at)
SELECT DISTINCT
  initcap(normalize_brand_label(s.brand_label)) AS brand_name,
  true,
  now()
FROM staging_products s
WHERE s.brand_label IS NOT NULL
  AND normalize_brand_label(s.brand_label) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM brands b 
    WHERE normalize_brand_label(b.name) = normalize_brand_label(s.brand_label)
  );