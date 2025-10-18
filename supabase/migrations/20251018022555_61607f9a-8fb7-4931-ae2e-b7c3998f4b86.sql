-- ============================================================================
-- AUTONOMOUS BRAND MONITORING - Deploy Cron Jobs (Simplified)
-- Treats ALL brands equally based on company_size priority
-- ============================================================================

-- Helper function to get internal token (if not exists)
CREATE OR REPLACE FUNCTION app.internal_headers()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer ' || (SELECT val FROM _secrets_internal WHERE key = 'INTERNAL_FN_TOKEN')
  );
$$;

-- Remove any existing jobs (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('high-priority-brands');
  PERFORM cron.unschedule('medium-priority-brands');
  PERFORM cron.unschedule('low-priority-brands');
  PERFORM cron.unschedule('weekly-baseline-scan');
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors if jobs don't exist
END $$;

-- High-priority brands (Fortune 500) - Every 30 minutes
SELECT cron.schedule(
  'high-priority-brands',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands',
    headers := app.internal_headers(),
    body := jsonb_build_object(
      'priority', 'high',
      'limit', 5
    )
  ) AS request_id;
  $$
);

-- Medium-priority brands (Large companies) - Every 6 hours
SELECT cron.schedule(
  'medium-priority-brands',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands',
    headers := app.internal_headers(),
    body := jsonb_build_object(
      'priority', 'medium',
      'limit', 10
    )
  ) AS request_id;
  $$
);

-- Low-priority brands (Medium/Small companies) - Daily at 2 AM UTC
SELECT cron.schedule(
  'low-priority-brands',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-process-brands',
    headers := app.internal_headers(),
    body := jsonb_build_object(
      'priority', 'low',
      'limit', 20
    )
  ) AS request_id;
  $$
);

-- Weekly baseline scan for brands missing baselines - Sundays at 3 AM UTC
SELECT cron.schedule(
  'weekly-baseline-scan',
  '0 3 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/historical-baseline-scanner',
    headers := app.internal_headers()
  ) AS request_id;
  $$
);