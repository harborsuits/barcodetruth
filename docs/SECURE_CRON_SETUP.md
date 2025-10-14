# Secure Cron Job Setup

## Step 1: Generate a Strong Token

```bash
openssl rand -base64 32
```

Save this token securely - you'll need it in the next steps.

## Step 2: Add Environment Variable to Supabase

1. Go to your Supabase project dashboard
2. Navigate to **Project Settings** → **Edge Functions** (or **Environment Variables**)
3. Add a new environment variable:
   - Name: `INTERNAL_FN_TOKEN`
   - Value: `<your-generated-token-from-step-1>`
4. Save and redeploy your Edge Functions

## Step 3: Schedule Cron Jobs

Run this SQL in your Supabase SQL Editor, replacing `<TOKEN>` with your generated token:

```sql
-- Pull feeds (every 15 min)
SELECT cron.schedule(
  'pull-feeds-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds',
    headers := jsonb_build_object(
      'x-internal-token', '<TOKEN>',
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Brand match (every 10 min)
SELECT cron.schedule(
  'brand-match-10m',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match',
    headers := jsonb_build_object(
      'x-internal-token', '<TOKEN>',
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 45000
  );
  $$
);

-- Resolve evidence (every 15 min)
SELECT cron.schedule(
  'resolve-evidence-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
    headers := jsonb_build_object(
      'x-internal-token', '<TOKEN>',
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Calculate baselines (nightly at 2:10 AM)
SELECT cron.schedule(
  'calculate-baselines-nightly',
  '10 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines',
    headers := jsonb_build_object(
      'x-internal-token', '<TOKEN>',
      'x-cron', '1',
      'content-type', 'application/json'
    ),
    body := jsonb_build_object('mode', 'batch'),
    timeout_milliseconds := 300000
  );
  $$
);
```

## Step 4: Verify Setup

Test that the security is working:

```bash
# Should return 403 (missing headers)
curl -i https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds

# Should return 403 (only one header)
curl -i -H "x-cron: 1" https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds

# Should return 200 (both headers present)
curl -i -H "x-cron: 1" \
     -H "x-internal-token: <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{}' \
     https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds
```

Check that cron jobs are running:

```sql
SELECT jobname, last_run, status, return_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

## Security Features

✅ **Dual-header authentication**: Requires both `x-internal-token` and `x-cron: 1`  
✅ **Rate limiting**: Built-in protection via `cron_runs` table (prevents spam if token leaks)  
✅ **Structured logging**: All blocked requests are logged with context  

## Token Rotation

To rotate the token:

1. Generate a new token: `openssl rand -base64 32`
2. Update environment variable in Supabase dashboard
3. Redeploy Edge Functions
4. Update cron job SQL with new token
