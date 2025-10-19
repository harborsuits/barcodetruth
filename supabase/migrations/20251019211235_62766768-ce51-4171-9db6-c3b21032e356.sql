-- Security fix: Add authorization checks to SECURITY DEFINER functions
-- Addresses SUPA_security_definer_view linter warning

-- 1. Fix admin_refresh_coverage to require admin role
CREATE OR REPLACE FUNCTION public.admin_refresh_coverage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SECURITY: Verify caller is admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  
  REFRESH MATERIALIZED VIEW CONCURRENTLY brand_data_coverage;
END;
$$;

-- 2. Restrict refresh functions to service role only (not public users)
REVOKE EXECUTE ON FUNCTION public.refresh_brand_coverage() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.refresh_coverage_materialized_view() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_brand_coverage() TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_coverage_materialized_view() TO service_role;

-- 3. Restrict internal scoring functions to service role only
REVOKE EXECUTE ON FUNCTION public.get_brands_needing_scores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_brands_needing_scores() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_corroboration_clusters(integer, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_corroboration_clusters(integer, numeric, integer) TO service_role;

-- 4. Audit: These functions are intentionally public (no changes needed):
-- - brand_profile_view(brand_id) - requires brand_id parameter
-- - scan_product_lookup(upc) - requires UPC parameter  
-- - search_catalog(query) - public search is intentional
-- - compute_brand_score(brand_id) - requires brand_id parameter
-- - has_role/is_admin/is_mod_or_admin - auth helpers
-- - can_user_scan(user_id) - user-specific checks

COMMENT ON FUNCTION public.admin_refresh_coverage IS 'Admin-only function to refresh materialized views. Requires admin role.';
COMMENT ON FUNCTION public.refresh_brand_coverage IS 'Service role only - refresh coverage cache. Not accessible to end users.';
COMMENT ON FUNCTION public.get_brands_needing_scores IS 'Service role only - internal scoring function. Not accessible to end users.';
COMMENT ON FUNCTION public.get_corroboration_clusters IS 'Service role only - internal event clustering. Not accessible to end users.';