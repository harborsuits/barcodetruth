-- Fix admin_add_evidence to use event_date in ON CONFLICT (matches unique constraint)
-- Optimize search_catalog query ordering for better performance

-- 1) Fix admin_add_evidence idempotency
CREATE OR REPLACE FUNCTION public.admin_add_evidence(
  p_brand_id uuid,
  p_title text,
  p_source_url text,
  p_verification text,
  p_category text,
  p_event_date date,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(event_id uuid, source_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_source_id uuid;
  v_dom text;
  v_src text;
  v_url text;
BEGIN
  -- Validate inputs
  IF p_brand_id IS NULL OR p_title IS NULL OR p_source_url IS NULL THEN
    RAISE EXCEPTION 'brand_id, title, and source_url are required';
  END IF;

  -- Parse URL
  SELECT domain_owner, source_name, canonical_url
  INTO v_dom, v_src, v_url
  FROM public.canonicalize_source_url(p_source_url)
  LIMIT 1;

  -- Upsert event by (brand_id, event_date, title) - matches unique constraint
  INSERT INTO public.brand_events (
    brand_id, 
    title, 
    event_date,
    occurred_at, 
    verification, 
    category, 
    description
  )
  VALUES (
    p_brand_id, 
    p_title,
    p_event_date,
    p_event_date::timestamp with time zone, 
    p_verification::verification_level, 
    p_category::event_category, 
    p_notes
  )
  ON CONFLICT (brand_id, event_date, title)
  DO UPDATE SET 
    verification = EXCLUDED.verification,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    occurred_at = EXCLUDED.occurred_at
  RETURNING brand_events.event_id INTO v_event_id;

  -- Insert/merge source (one per event+url)
  INSERT INTO public.event_sources (
    event_id, 
    source_name, 
    domain_owner, 
    canonical_url
  )
  VALUES (v_event_id, v_src, v_dom, v_url)
  ON CONFLICT (event_id, canonical_url)
  DO UPDATE SET
    source_name = EXCLUDED.source_name,
    domain_owner = EXCLUDED.domain_owner
  RETURNING id INTO v_source_id;

  -- Refresh coverage aggregates
  PERFORM public.refresh_brand_coverage();

  RETURN QUERY SELECT v_event_id, v_source_id;
END;
$$;

-- 2) Optimize search_catalog: prioritize ILIKE for short queries
CREATE OR REPLACE FUNCTION search_catalog(p_q text, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH product_matches AS (
    SELECT 
      id,
      name,
      category,
      brand_id,
      barcode,
      similarity(name, p_q) as sim
    FROM products
    WHERE (length(p_q) < 3 AND name ILIKE p_q || '%')
       OR (length(p_q) >= 3 AND (name ILIKE '%' || p_q || '%' OR similarity(name, p_q) > 0.3))
    ORDER BY sim DESC, name
    LIMIT p_limit
  ),
  brand_matches AS (
    SELECT 
      id,
      name,
      parent_company,
      similarity(name, p_q) as sim
    FROM brands
    WHERE (length(p_q) < 3 AND name ILIKE p_q || '%')
       OR (length(p_q) >= 3 AND (name ILIKE '%' || p_q || '%' OR similarity(name, p_q) > 0.3))
    ORDER BY sim DESC, name
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'products', COALESCE((SELECT jsonb_agg(to_jsonb(pm.*)) FROM product_matches pm), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(to_jsonb(bm.*)) FROM brand_matches bm), '[]'::jsonb)
  ) INTO result;
  
  RETURN result;
END;
$$;