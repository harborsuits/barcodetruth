
-- View: duplicate clusters by normalized_name
CREATE OR REPLACE VIEW public.v_brand_duplicate_clusters AS
SELECT
  b.normalized_name,
  COUNT(*)::int AS cluster_size,
  jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'slug', b.slug,
      'status', b.status,
      'created_at', b.created_at
    ) ORDER BY
      CASE WHEN b.status = 'active' THEN 0
           WHEN b.status = 'ready'  THEN 1
           WHEN b.status = 'building' THEN 2
           WHEN b.status = 'stub' THEN 3
           ELSE 4 END,
      b.created_at ASC
  ) AS brands
FROM public.brands b
WHERE b.normalized_name IS NOT NULL
  AND length(b.normalized_name) > 0
GROUP BY b.normalized_name
HAVING COUNT(*) > 1;

-- Safe merge function: reassigns all FK-style references then deletes duplicate
CREATE OR REPLACE FUNCTION public.merge_brands(
  p_canonical_id uuid,
  p_duplicate_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dup_name text;
  v_dup_slug text;
  v_canonical_exists boolean;
  v_dup_exists boolean;
  v_reassigned jsonb := '{}'::jsonb;
  v_count int;
  v_tbl text;
  v_col text;
  v_pair record;
BEGIN
  -- Auth check
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can merge brands';
  END IF;

  IF p_canonical_id = p_duplicate_id THEN
    RAISE EXCEPTION 'Canonical and duplicate must differ';
  END IF;

  SELECT EXISTS(SELECT 1 FROM brands WHERE id = p_canonical_id) INTO v_canonical_exists;
  SELECT name, slug FROM brands WHERE id = p_duplicate_id INTO v_dup_name, v_dup_slug;
  v_dup_exists := v_dup_name IS NOT NULL;

  IF NOT v_canonical_exists THEN
    RAISE EXCEPTION 'Canonical brand % not found', p_canonical_id;
  END IF;
  IF NOT v_dup_exists THEN
    RAISE EXCEPTION 'Duplicate brand % not found', p_duplicate_id;
  END IF;

  -- Reassign all known brand_id columns in real tables
  FOR v_pair IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      AND c.column_name IN ('brand_id', 'alternative_brand_id', 'canonical_brand_id')
      AND c.table_name NOT IN ('brands') -- skip the brands table itself
  LOOP
    v_tbl := v_pair.table_name;
    v_col := v_pair.column_name;
    BEGIN
      EXECUTE format(
        'UPDATE public.%I SET %I = $1 WHERE %I = $2',
        v_tbl, v_col, v_col
      ) USING p_canonical_id, p_duplicate_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count > 0 THEN
        v_reassigned := v_reassigned || jsonb_build_object(v_tbl || '.' || v_col, v_count);
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- For unique-constrained tables (e.g. brand_baselines, brand_display_profiles),
      -- the canonical already has a row; delete the duplicate's row instead.
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', v_tbl, v_col)
        USING p_duplicate_id;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_reassigned := v_reassigned || jsonb_build_object(
        v_tbl || '.' || v_col || ' (deleted dup)', v_count
      );
    END;
  END LOOP;

  -- Preserve the duplicate's name as an alias on the canonical (best effort)
  BEGIN
    INSERT INTO public.brand_aliases (canonical_brand_id, external_name, source)
    VALUES (p_canonical_id, v_dup_name, 'merge')
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Delete the duplicate brand
  DELETE FROM public.brands WHERE id = p_duplicate_id;

  RETURN jsonb_build_object(
    'success', true,
    'canonical_id', p_canonical_id,
    'merged_id', p_duplicate_id,
    'merged_name', v_dup_name,
    'reassigned', v_reassigned
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_brands(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_brands(uuid, uuid) TO authenticated;

-- Grant view access (RLS-friendly: brands view is public-readable already)
GRANT SELECT ON public.v_brand_duplicate_clusters TO authenticated;
