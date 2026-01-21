
-- Fix critical SECURITY DEFINER views by setting security_invoker = true
-- This ensures views respect the caller's RLS policies instead of the view creator's

-- Fix brand_events_with_inheritance (critical for scoring)
ALTER VIEW brand_events_with_inheritance SET (security_invoker = true);

-- Fix brand_standings (public-facing)
ALTER VIEW brand_standings SET (security_invoker = true);

-- Fix brand_score_effective (scoring)
ALTER VIEW brand_score_effective SET (security_invoker = true);

-- Fix v_baseline_inputs_90d (scoring inputs)
ALTER VIEW v_baseline_inputs_90d SET (security_invoker = true);

-- Fix v_baseline_inputs_24m (scoring inputs)
ALTER VIEW v_baseline_inputs_24m SET (security_invoker = true);

-- Fix v_brands_needing_logos (admin)
ALTER VIEW v_brands_needing_logos SET (security_invoker = true);

-- Fix v_brand_sources_inline (public)
ALTER VIEW v_brand_sources_inline SET (security_invoker = true);

-- Fix v_ownership_trail (ownership display)
ALTER VIEW v_ownership_trail SET (security_invoker = true);

-- Fix brand_score_movers_24h (trending)
ALTER VIEW brand_score_movers_24h SET (security_invoker = true);

-- Fix v_user_preferences_safe (user data)
ALTER VIEW v_user_preferences_safe SET (security_invoker = true);

-- Fix v_parent_rollups (ownership)
ALTER VIEW v_parent_rollups SET (security_invoker = true);
