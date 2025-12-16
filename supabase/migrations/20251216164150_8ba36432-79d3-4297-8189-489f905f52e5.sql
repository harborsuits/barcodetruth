-- Secure admin function to verify brand identity
-- Only admins can call this (enforced server-side)
CREATE OR REPLACE FUNCTION public.admin_verify_brand_identity(p_brand_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Perform the update
  UPDATE public.brands
  SET 
    identity_confidence = 'high',
    identity_notes = 'manual_verified',
    status = 'ready',
    updated_at = now()
  WHERE id = p_brand_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'brand_id', p_brand_id
  );
END;
$$;