
-- ============================================================================
-- SECURITY FIXES: Function search_path, Extension placement, RLS policies
-- ============================================================================

-- 1) Create extensions schema and move pg_trgm out of public
-- ============================================================================
CREATE SCHEMA IF NOT EXISTS extensions AUTHORIZATION postgres;

-- Move pg_trgm extension to extensions schema (functions move with it)
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- Configure search_path for app roles to include extensions schema
ALTER ROLE anon IN DATABASE postgres SET search_path = "extensions", public;
ALTER ROLE authenticated IN DATABASE postgres SET search_path = "extensions", public;
ALTER ROLE service_role IN DATABASE postgres SET search_path = "extensions", public;

-- 2) Pin search_path on custom application functions
-- ============================================================================
-- Note: Extension functions (pg_trgm) are C-level functions owned by postgres
-- and don't require search_path changes. We only fix custom SQL functions.

ALTER FUNCTION public.verification_rank(v text) 
  SET search_path = pg_catalog, extensions, public;

-- 3) Disable RLS for internal job queue tables
-- ============================================================================
-- These are internal queue tables accessed only by edge functions with service role

ALTER TABLE public.jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs_dead DISABLE ROW LEVEL SECURITY;

-- 4) Restrict public schema privileges
-- ============================================================================
-- Ensure minimal privileges on public schema
REVOKE ALL ON SCHEMA public FROM public;
GRANT USAGE ON SCHEMA public TO anon, authenticated;
