-- Create RPC function for brand ownership header
-- Returns: owner_company_name, ultimate_parent_name, is_ultimate_parent

CREATE OR REPLACE FUNCTION public.rpc_get_brand_ownership_header(p_brand_id uuid)
RETURNS TABLE (
  owner_company_name text,
  ultimate_parent_name text,
  is_ultimate_parent boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_parent_id uuid;
  v_parent_name text;
  v_ultimate_id uuid;
  v_ultimate_name text;
  v_depth int := 0;
  v_max_depth int := 10;
BEGIN
  -- Get direct parent
  SELECT 
    co.parent_company_id,
    COALESCE(co.parent_name, pb.name)
  INTO v_parent_id, v_parent_name
  FROM company_ownership co
  LEFT JOIN brands pb ON pb.id = co.parent_company_id
  WHERE co.child_brand_id = p_brand_id
  ORDER BY co.confidence DESC NULLS LAST, co.created_at DESC
  LIMIT 1;
  
  -- If no parent, brand is ultimate parent
  IF v_parent_id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::text as owner_company_name,
      NULL::text as ultimate_parent_name,
      true as is_ultimate_parent;
    RETURN;
  END IF;
  
  -- Walk up ownership chain to find ultimate parent
  v_ultimate_id := v_parent_id;
  v_ultimate_name := v_parent_name;
  
  LOOP
    v_depth := v_depth + 1;
    EXIT WHEN v_depth >= v_max_depth;
    
    SELECT 
      co.parent_company_id,
      COALESCE(co.parent_name, pb.name)
    INTO v_parent_id, v_parent_name
    FROM company_ownership co
    LEFT JOIN brands pb ON pb.id = co.parent_company_id
    WHERE co.child_brand_id = v_ultimate_id
    ORDER BY co.confidence DESC NULLS LAST, co.created_at DESC
    LIMIT 1;
    
    EXIT WHEN v_parent_id IS NULL;
    
    v_ultimate_id := v_parent_id;
    v_ultimate_name := v_parent_name;
  END LOOP;
  
  -- Return direct parent and ultimate parent
  RETURN QUERY SELECT 
    (SELECT COALESCE(co.parent_name, pb.name)
     FROM company_ownership co
     LEFT JOIN brands pb ON pb.id = co.parent_company_id
     WHERE co.child_brand_id = p_brand_id
     ORDER BY co.confidence DESC NULLS LAST, co.created_at DESC
     LIMIT 1) as owner_company_name,
    v_ultimate_name as ultimate_parent_name,
    false as is_ultimate_parent;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.rpc_get_brand_ownership_header(uuid) TO anon, authenticated;