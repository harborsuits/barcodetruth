-- Fix admin_add_evidence to use correct admin check
CREATE OR REPLACE FUNCTION public.admin_add_evidence(
  p_brand_id uuid,
  p_title text,
  p_url text,
  p_verification text DEFAULT 'official',
  p_category text DEFAULT 'other',
  p_occurred_at timestamptz DEFAULT now(),
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
  v_result jsonb;
BEGIN
  -- Verify caller is admin using correct pattern
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Upsert event (idempotent on brand_id, occurred_at, title)
  INSERT INTO public.brand_events (
    brand_id,
    title,
    source_url,
    verification,
    category,
    occurred_at,
    event_date,
    description,
    verified
  ) VALUES (
    p_brand_id,
    p_title,
    p_url,
    p_verification::verification_level,
    p_category::event_category,
    p_occurred_at,
    p_occurred_at, -- sync event_date with occurred_at
    p_notes,
    true
  )
  ON CONFLICT (brand_id, occurred_at, title)
  DO UPDATE SET
    source_url = EXCLUDED.source_url,
    verification = EXCLUDED.verification,
    category = EXCLUDED.category,
    description = EXCLUDED.description,
    updated_at = now()
  RETURNING event_id INTO v_event_id;

  -- Refresh coverage stats
  BEGIN
    PERFORM refresh_brand_coverage();
  EXCEPTION WHEN undefined_function THEN
    NULL; -- Coverage refresh not available yet
  END;

  -- Return success
  v_result := jsonb_build_object(
    'success', true,
    'event_id', v_event_id,
    'brand_id', p_brand_id
  );

  RETURN v_result;
END;
$$;