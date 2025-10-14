-- Harden _secrets_internal table security
ALTER TABLE _secrets_internal OWNER TO postgres;
REVOKE ALL ON TABLE _secrets_internal FROM PUBLIC, authenticated, anon;

-- Ensure app schema is properly owned
CREATE SCHEMA IF NOT EXISTS app;
ALTER SCHEMA app OWNER TO postgres;

-- Recreate internal_headers with safe search_path to prevent hijacking
CREATE OR REPLACE FUNCTION app.internal_headers()
RETURNS jsonb
SECURITY DEFINER
SET search_path = pg_catalog, public, app
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'x-internal-token', (SELECT val FROM _secrets_internal WHERE key='INTERNAL_FN_TOKEN'),
    'x-cron', '1',
    'Content-Type', 'application/json'
  );
$$;

-- Lock down function execution
REVOKE ALL ON FUNCTION app.internal_headers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app.internal_headers() TO postgres;