
-- =========================================================================
-- 1) Restrict "Service role" policies to the service_role role only
-- =========================================================================

-- user_billing
ALTER POLICY "Service role can manage billing" ON public.user_billing TO service_role;

-- stripe_customers
ALTER POLICY "Service role can manage stripe_customers" ON public.stripe_customers TO service_role;

-- stripe_events
ALTER POLICY "Service role can manage stripe_events" ON public.stripe_events TO service_role;

-- api_rate_limits
ALTER POLICY "Service role can manage rate limits" ON public.api_rate_limits TO service_role;

-- brand_api_usage
ALTER POLICY "Service role can manage brand API usage" ON public.brand_api_usage TO service_role;

-- brand_baselines
ALTER POLICY "Service role can manage baselines" ON public.brand_baselines TO service_role;

-- classification_audit
ALTER POLICY "Service role can manage classification audit" ON public.classification_audit TO service_role;

-- company_groups_cache
ALTER POLICY "Service role write company_groups_cache" ON public.company_groups_cache TO service_role;

-- company_relations
ALTER POLICY "Service role write company_relations" ON public.company_relations TO service_role;

-- company_shareholders
ALTER POLICY "Service role write company_shareholders" ON public.company_shareholders TO service_role;

-- data_quality_log
ALTER POLICY "Service role manage data_quality_log" ON public.data_quality_log TO service_role;

-- data_quality_metrics
ALTER POLICY "Service role manage data_quality_metrics" ON public.data_quality_metrics TO service_role;

-- evidence_resolution_runs
ALTER POLICY "Service role can manage resolution runs" ON public.evidence_resolution_runs TO service_role;

-- score_runs
ALTER POLICY "Service role can manage score runs" ON public.score_runs TO service_role;

-- brand_daily_digest
ALTER POLICY "Service role manage brand_daily_digest" ON public.brand_daily_digest TO service_role;

-- company_ownership (INSERT-only service role)
ALTER POLICY "Service role write company_ownership" ON public.company_ownership TO service_role;

-- company_valuation (INSERT-only service role)
ALTER POLICY "Service role write company_valuation" ON public.company_valuation TO service_role;

-- companies (ALL service role)
ALTER POLICY "Service role write companies" ON public.companies TO service_role;

-- security_audit_log: insert-only by service role
ALTER POLICY "Service role can insert audit logs" ON public.security_audit_log TO service_role;

-- =========================================================================
-- 2) event_disputes: stop exposing emails publicly
-- =========================================================================

DROP POLICY IF EXISTS "Anyone can read own disputes" ON public.event_disputes;

-- Replace with admin-only read access
CREATE POLICY "Admins can read disputes"
  ON public.event_disputes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =========================================================================
-- 3) rejected_entities: replace user-metadata admin check with user_roles check
-- =========================================================================

ALTER POLICY "Admin read rejected entities" ON public.rejected_entities
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- =========================================================================
-- 4) Public storage buckets: stop allowing file listing while keeping
--    public direct-URL access (Supabase serves files from public buckets
--    via /storage/v1/object/public/... without needing an RLS read policy).
-- =========================================================================

DROP POLICY IF EXISTS "Public read brand logos" ON storage.objects;
DROP POLICY IF EXISTS "Public read snapshots" ON storage.objects;
DROP POLICY IF EXISTS "Public read access" ON storage.objects;
DROP POLICY IF EXISTS "seed_files_public_read_v2" ON storage.objects;
