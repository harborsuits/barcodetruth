# Cron Secret Setup for process-brand-stubs

The `process-brand-stubs` edge function is protected with a `CRON_SECRET` header to prevent unauthorized triggering.

## Setup Steps (BOTH REQUIRED)

### Step 1: Edge Function Secret
Add `CRON_SECRET` in Supabase Dashboard → Edge Functions → Secrets.

### Step 2: Database Setting (CRITICAL - Must Run Manually)

**This cannot be done via migrations.** Run this SQL directly in the Supabase SQL Editor:

```sql
-- IMPORTANT: Use the EXACT same value as your Edge Function secret
ALTER DATABASE postgres SET app.cron_secret = 'YOUR_CRON_SECRET_VALUE';
```

Then verify it persisted:
```sql
SHOW app.cron_secret;
```

### Step 3: Create the Cron Job

Remove any old job first:
```sql
SELECT cron.unschedule('process-brand-stubs-5m');
```

Create the secure job (no Authorization header needed - x-cron-secret is the gate):
```sql
SELECT cron.schedule(
  'process-brand-stubs-5m',
  '*/5 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/process-brand-stubs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', current_setting('app.cron_secret', true)
      ),
      body := '{}'::jsonb
    );
  $$
);
```

Verify it exists:
```sql
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'process-brand-stubs-5m';
```

## How It Works

1. pg_cron reads `app.cron_secret` from database settings via `current_setting()`
2. Cron job calls `process-brand-stubs` with `x-cron-secret` header
3. Edge function validates header against `CRON_SECRET` env var
4. Mismatched/missing secret → 401 Unauthorized

## Verification

Test with correct secret (should return 200):
```bash
curl -X POST https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/process-brand-stubs \
  -H "Content-Type: application/json" \
  -H "x-cron-secret: YOUR_SECRET_VALUE" \
  -d '{}'
```

Test without secret (should return 401):
```bash
curl -X POST https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/process-brand-stubs \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Troubleshooting

**`SHOW app.cron_secret` returns empty?**
- You used `set_config()` instead of `ALTER DATABASE` - that's session-only
- Run `ALTER DATABASE postgres SET app.cron_secret = '...'` properly

**Cron job returns 401?**
- Check Edge Function secret matches database setting exactly
- Verify with `SHOW app.cron_secret;`

## Stage Tracking

The enrichment pipeline writes these stages to `brands.enrichment_stage`:

| Stage | Description |
|-------|-------------|
| `started` | Brand claimed for processing |
| `wikidata_search` | Searching Wikidata for entity |
| `identity_validation` | Validating entity matches brand |
| `wikipedia_fallback` | Falling back to Wikipedia |
| `writing_profile` | Writing description to database |
| `computing_score` | Extracting ownership/people |
| `done` | Enrichment complete |
| `failed` | Enrichment failed |

The UI (`EnrichmentStageProgress` component) displays these stages in real-time.
