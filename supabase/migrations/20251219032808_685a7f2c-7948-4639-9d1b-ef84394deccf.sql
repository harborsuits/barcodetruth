-- Create admin RPC to verify brand identity
CREATE OR REPLACE FUNCTION public.admin_verify_brand_identity(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  -- Check if user is admin
  IF v_user_id IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin
    FROM user_profiles
    WHERE user_id = v_user_id;
  END IF;
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  
  -- Update brand identity to verified
  UPDATE brands
  SET 
    identity_confidence = 'high',
    identity_notes = COALESCE(identity_notes, '') || ' | Admin verified at ' || now()::text,
    status = CASE WHEN status = 'stub' THEN 'ready' ELSE status END,
    updated_at = now()
  WHERE id = p_brand_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Brand not found: %', p_brand_id;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'brand_id', p_brand_id,
    'verified_at', now()
  );
END;
$$;

-- Grant execute to authenticated users (function checks admin status internally)
GRANT EXECUTE ON FUNCTION public.admin_verify_brand_identity(UUID) TO authenticated;