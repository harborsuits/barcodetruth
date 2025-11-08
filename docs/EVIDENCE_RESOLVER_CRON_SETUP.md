# Evidence Resolver Cron Setup

## Overview
The `resolve-evidence-links` Edge Function now uses `x-cron-token` authentication for secure server-to-server communication.

## Quick Setup (5 minutes)

### 1. Generate and Set the Secret

In your terminal:
```bash
# Generate a secure random token
CRON_SECRET=$(openssl rand -hex 32)

# Set it as an Edge Function secret
echo $CRON_SECRET
# Copy the output, then in Supabase Dashboard:
# Settings → Edge Functions → Secrets → Add new secret
# Name: CRON_SECRET
# Value: <paste the token>
```

**Important:** Save this token - you'll need it in step 2.

### 2. Store Token in Database

Run this SQL in your Supabase SQL Editor:
```sql
-- Replace <YOUR_TOKEN> with the exact value from step 1
ALTER DATABASE postgres SET app.cron_secret = '<YOUR_TOKEN>';
SELECT pg_reload_conf();
```

### 3. Create/Update the Cron Job

```sql
-- Drop existing job if present
SELECT cron.unschedule('resolve-evidence-links-30m');

-- Schedule with proper authentication
SELECT cron.schedule(
  'resolve-evidence-links-30m',
  '*/30 * * * *',  -- Every 30 minutes
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-token', current_setting('app.cron_secret', true)
    ),
    body := jsonb_build_object(
      'mode', 'agency-first',
      'limit', 50
    ),
    timeout_milliseconds := 30000
  );
  $$
);
```

### 4. Verify Setup

Check recent job runs:
```sql
SELECT 
  job_id,
  jobname,
  status,
  return_message,
  start_time
FROM cron.job_run_details 
WHERE jobname = 'resolve-evidence-links-30m'
ORDER BY start_time DESC 
LIMIT 5;
```

Check function logs in Supabase Dashboard:
- Go to Edge Functions → resolve-evidence-links → Logs
- Look for success messages (no `blocked: true` warnings)

## Manual Test (Optional)

Test the function manually with correct auth:
```bash
# Replace <YOUR_TOKEN> with your CRON_SECRET
curl -i 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links' \
  -H 'Content-Type: application/json' \
  -H 'x-cron-token: <YOUR_TOKEN>' \
  -d '{"mode":"agency-first","limit":10}'
```

**Expected:** HTTP 200 with JSON response showing processed/resolved counts

## Dev Bypass (Testing Only)

For quick testing without exposing secrets:

1. Set bypass flag:
```bash
# In Supabase Dashboard: Settings → Edge Functions → Secrets
# Add: ALLOW_DEV_BYPASS = true
```

2. Test without auth:
```bash
curl -i 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?dev=1' \
  -H 'Content-Type: application/json' \
  -d '{"mode":"agency-first","limit":5}'
```

**Warning:** Remove `ALLOW_DEV_BYPASS` in production!

## Troubleshooting

### Still seeing "missing-cron-header" errors?
- Verify the cron job is sending `x-cron-token` header
- Check that `current_setting('app.cron_secret', true)` returns a value in SQL

### Seeing "token-mismatch" errors?
- Verify the Edge Function secret matches the database GUC:
```sql
-- In SQL Editor
SELECT current_setting('app.cron_secret', true);
```
- Compare with Edge Function secret in Dashboard → Settings → Edge Functions → Secrets

### Job not running at all?
- Check if job is active:
```sql
SELECT jobid, jobname, schedule, active 
FROM cron.job 
WHERE jobname = 'resolve-evidence-links-30m';
```

## Configuration Options

### Adjust Frequency
Change the cron schedule (2nd parameter):
- Every 15 minutes: `'*/15 * * * *'`
- Every hour: `'0 * * * *'`
- Daily at 2 AM: `'0 2 * * *'`

### Adjust Batch Size
Change `limit` in the body JSON:
```sql
body := jsonb_build_object(
  'mode', 'agency-first',
  'limit', 100  -- Process 100 sources per run
),
```

### Change Resolution Mode
- `'agency-only'`: Only resolve agency permalinks (OSHA, EPA, FEC)
- `'agency-first'`: Try agencies first, then outlet discovery (recommended)
- `'full'`: Full outlet discovery with RSS/homepage parsing

## Security Notes

- The `CRON_SECRET` should be a long random string (32+ characters)
- Never expose the secret in client-side code
- Store it only in Edge Function secrets and the database GUC
- Rotate periodically (recommended: every 90 days)

## Next Steps

After setup completes successfully:
1. Monitor logs for the first few runs
2. Check `evidence_resolution_runs` table for metrics
3. Verify resolved sources in `event_sources` table
4. Adjust frequency/limits based on load
