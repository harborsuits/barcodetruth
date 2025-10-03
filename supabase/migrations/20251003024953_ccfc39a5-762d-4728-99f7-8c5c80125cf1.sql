
-- ============================================================================
-- FIX: Add RLS policies for jobs tables (service role only access)
-- ============================================================================
-- The previous migration disabled RLS, but the linter requires it enabled.
-- These tables should only be accessible by edge functions using service_role.

-- Re-enable RLS on jobs tables
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs_dead ENABLE ROW LEVEL SECURITY;

-- Jobs table: service role full access
CREATE POLICY "Service role has full access to jobs"
ON public.jobs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Jobs_dead table: service role full access
CREATE POLICY "Service role has full access to jobs_dead"
ON public.jobs_dead
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
