# Secure Cron Job Setup

## Overview

This setup uses:
- **Dual-header authentication**: Edge Functions require both `x-internal-token` and `x-cron: 1`
- **Centralized token storage**: Token stored in `_secrets_internal` table (postgres-owned, no RLS)
- **SECURITY DEFINER helper**: `app.internal_headers()` safely retrieves token for cron jobs
- **Rate limiting**: Built-in via `cron_runs` table

## Step 1: Set the Token

The migration has already created the `_secrets_internal` table and `app.internal_headers()` helper.

Run this SQL once to set your actual token:

```sql
UPDATE _secrets_internal
SET val = 'YOUR_ACTUAL_INTERNAL_FN_TOKEN'
WHERE key = 'INTERNAL_FN_TOKEN';
```

Replace `YOUR_ACTUAL_INTERNAL_FN_TOKEN` with your token from Supabase environment variables.

## Step 2: Verify Security Lockdown

The cron jobs are already scheduled (via migration) to use `app.internal_headers()`. Verify they're active:

```sql
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname IN ('pull-feeds-15m','brand-match-15m','resolve-evidence-links-15m','calculate-baselines-nightly')
ORDER BY jobid;
```

## Step 3: Test Authentication

Verify dual-header authentication:

```bash
# Should return 403 (missing headers)
curl -i https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds

# Should return 403 (only one header)
curl -i -H "x-cron: 1" https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds

# Should return 200 (both headers present - token from env)
curl -i -H "x-cron: 1" \
     -H "x-internal-token: YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{}' \
     https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds
```

## Step 4: Monitor Cron Execution

```sql
-- Check recent runs
SELECT jobname, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;

-- Pipeline health (last 30 minutes)
SELECT
  COUNT(*) FILTER (WHERE created_at > now()-interval '30 min') AS rss_30m,
  COUNT(*) FILTER (WHERE status='matched' AND created_at > now()-interval '30 min') AS matched_30m
FROM rss_items;

-- Events flowing in?
SELECT
  (SELECT COUNT(*) FROM brand_events WHERE created_at > now()-interval '30 min') AS events_30m,
  (SELECT COUNT(*) FROM event_sources WHERE created_at > now()-interval '30 min') AS sources_30m;
```

## Security Features

✅ **Dual-header authentication**: Requires both `x-internal-token` and `x-cron: 1`  
✅ **Token isolation**: Stored in postgres-owned `_secrets_internal` (no RLS, no public access)  
✅ **SECURITY DEFINER helper**: Safe `search_path` prevents function hijacking  
✅ **Rate limiting**: Built-in via `cron_runs` table  
✅ **No SQL injection**: No generic "exec_sql" RPC functions  

## Token Rotation (Zero Downtime)

1. Generate new token: `openssl rand -base64 32`
2. Update in Supabase Edge Function environment variables
3. Update in database:
```sql
UPDATE _secrets_internal 
SET val = 'NEW_TOKEN_HERE' 
WHERE key = 'INTERNAL_FN_TOKEN';
```
4. Redeploy Edge Functions
5. Cron jobs automatically use new token via `app.internal_headers()`
