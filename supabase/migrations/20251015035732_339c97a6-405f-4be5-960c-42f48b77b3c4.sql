-- G: Admin Evidence Submitter - Database Functions

-- 1) Helper to canonicalize URLs (domain + normalized URL)
CREATE OR REPLACE FUNCTION public.canonicalize_source_url(p_url text)
RETURNS TABLE(domain_owner text, source_name text, canonical_url text)
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  WITH u AS (
    SELECT trim(p_url) AS raw
  ), n AS (
    SELECT raw,
           lower(regexp_replace(raw, '/+$','')) AS canonical_url
    FROM u
  ), d AS (
    SELECT canonical_url,
           regexp_replace(split_part(canonical_url, '/', 3), '^www\.', '') AS host
    FROM n
  )
  SELECT host AS domain_owner, host AS source_name, canonical_url FROM d;
$$;

-- 2) Upsert event + source + refresh coverage (single round-trip)
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

  -- Upsert event by (brand_id, event_date, title)
  INSERT INTO public.brand_events (
    brand_id, 
    title, 
    occurred_at, 
    verification, 
    category, 
    description
  )
  VALUES (
    p_brand_id, 
    p_title, 
    p_event_date::timestamp with time zone, 
    p_verification::verification_level, 
    p_category::event_category, 
    p_notes
  )
  ON CONFLICT (brand_id, occurred_at, title)
  DO UPDATE SET 
    verification = EXCLUDED.verification,
    category = EXCLUDED.category,
    description = EXCLUDED.description
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

-- Grant execute to authenticated users (will be gated by RLS on admin check)
GRANT EXECUTE ON FUNCTION public.admin_add_evidence TO authenticated;