# Cron Job Setup with Internal Token Authentication

## Overview
This document describes how to set up scheduled pg_cron jobs that securely call internal Edge Functions using the `INTERNAL_FN_TOKEN` authentication header.

## Purpose of INTERNAL_FN_TOKEN
The `INTERNAL_FN_TOKEN` secret provides authentication for internal-only Edge Functions that should not be accessible to public clients. Functions protected by this token include:
- `jobs-runner` - Processes queued background jobs
- `pull-feeds` - Fetches RSS feed updates
- `publish-snapshots` - Generates and caches brand/trending snapshots
- `calculate-baselines` - Recalculates brand baseline scores

These functions use the `requireInternal()` guard (defined in `supabase/functions/_shared/internal.ts`) to validate the `x-internal-token` header matches the configured secret.

## Prerequisites
Ensure these PostgreSQL extensions are enabled:
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Setting Up Cron Jobs

### Configuration Variables
- `<PROJECT-REF>`: Your Supabase project reference (e.g., `midmvcwtywnexzdwbekp`)
- `<TOKEN>`: Your `INTERNAL_FN_TOKEN` secret value

### Method 1: Direct Token in Jobs (Simple)

First, drop any existing jobs to avoid duplicates:
```sql
SELECT cron.unschedule('jobs-runner-5m');
SELECT cron.unschedule('pull-feeds-15m');
SELECT cron.unschedule('publish-snapshots-hourly');
SELECT cron.unschedule('calculate-baselines-nightly');
```

Then create the scheduled jobs:

#### Jobs Runner (Every 5 minutes)
```sql
SELECT cron.schedule(
  'jobs-runner-5m',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/jobs-runner',
    headers := jsonb_build_object(
      'x-internal-token', '<TOKEN>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
```

#### Pull Feeds (Every 15 minutes)
```sql
SELECT cron.schedule(
  'pull-feeds-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/pull-feeds',
    headers := jsonb_build_object(
      'x-internal-token', '<TOKEN>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
```

#### Publish Snapshots (Hourly at :05)
```sql
SELECT cron.schedule(
  'publish-snapshots-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/publish-snapshots',
    headers := jsonb_build_object(
      'x-internal-token', '<TOKEN>',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
```

#### Calculate Baselines (Nightly at 2:10 AM)
```sql
SELECT cron.schedule(
  'calculate-baselines-nightly',
  '10 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/calculate-baselines',
    headers := jsonb_build_object(
      'x-internal-token', '<TOKEN>',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'mode', 'batch'
    ),
    timeout_milliseconds := 60000
  );
  $$
);
```

### Method 2: Centralized Token Storage (Cleaner)

If you prefer not to repeat the token in multiple job definitions, store it once in a secure table:

```sql
-- Create secrets table (no RLS; postgres-only access)
CREATE TABLE IF NOT EXISTS _secrets_internal (
  key TEXT PRIMARY KEY,
  val TEXT NOT NULL
);

-- Store the token
INSERT INTO _secrets_internal(key, val) 
VALUES ('INTERNAL_FN_TOKEN', '<TOKEN>')
ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;

-- Helper function to build headers
CREATE OR REPLACE FUNCTION app.internal_headers()
RETURNS jsonb
SECURITY DEFINER
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'x-internal-token', (SELECT val FROM _secrets_internal WHERE key='INTERNAL_FN_TOKEN'),
    'Content-Type', 'application/json'
  );
$$;

-- Example usage in cron job
SELECT cron.schedule(
  'jobs-runner-5m',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT-REF>.supabase.co/functions/v1/jobs-runner',
    headers := app.internal_headers(),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);
```

## Verification

### List all scheduled jobs
```sql
SELECT * FROM cron.job ORDER BY jobid;
```

### Check recent job runs
```sql
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### View job execution status
```sql
SELECT 
  job_id,
  jobname,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details 
WHERE jobname IN (
  'jobs-runner-5m',
  'pull-feeds-15m', 
  'publish-snapshots-hourly',
  'calculate-baselines-nightly'
)
ORDER BY start_time DESC 
LIMIT 20;
```

## Token Rotation

When rotating the `INTERNAL_FN_TOKEN`:

1. Update the secret in Supabase project settings
2. If using Method 1: Update all cron jobs with the new token
3. If using Method 2: Update only the `_secrets_internal` table:
   ```sql
   UPDATE _secrets_internal 
   SET val = '<NEW-TOKEN>' 
   WHERE key = 'INTERNAL_FN_TOKEN';
   ```

## Disabling Jobs

To temporarily disable a job without deleting it:
```sql
-- Disable
UPDATE cron.job SET active = false WHERE jobname = 'jobs-runner-5m';

-- Re-enable
UPDATE cron.job SET active = true WHERE jobname = 'jobs-runner-5m';
```

To permanently remove a job:
```sql
SELECT cron.unschedule('jobs-runner-5m');
```

## Troubleshooting

### Job not running
1. Check if the job is active: `SELECT * FROM cron.job WHERE jobname = 'your-job-name';`
2. Check recent run details for errors: `SELECT * FROM cron.job_run_details WHERE jobname = 'your-job-name' ORDER BY start_time DESC LIMIT 5;`
3. Verify the Edge Function is deployed and accessible
4. Check Edge Function logs for authentication errors

### 403 Forbidden errors
- Verify the `INTERNAL_FN_TOKEN` secret matches in both the Edge Function environment and the cron job
- Check that the `x-internal-token` header is being sent correctly
- Review Edge Function logs for blocked requests

### Timeout errors
- Increase `timeout_milliseconds` for long-running functions
- Consider breaking large operations into smaller background jobs
- Monitor Edge Function execution times

## Security Notes

- The `INTERNAL_FN_TOKEN` should be a strong, randomly generated value
- Never expose this token in client-side code or public APIs
- Rotate the token periodically (recommended: every 90 days)
- Keep a copy of the token in a secure password manager
- If using Method 2, ensure the `_secrets_internal` table has no RLS policies and is only accessible to postgres role
