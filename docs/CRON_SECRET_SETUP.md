# Cron Secret Setup for process-brand-stubs

The `process-brand-stubs` edge function is now protected with a `CRON_SECRET` header to prevent unauthorized triggering.

## Setup Steps

### 1. Edge Function Secret (Already Done)
The `CRON_SECRET` environment variable has been added to the Supabase Edge Function secrets.

### 2. Database Setting (Required)
Run this SQL to set the secret in database settings so pg_cron can access it:

```sql
-- Replace 'your-actual-secret-value' with the same value you entered in the secrets modal
ALTER DATABASE postgres SET app.cron_secret = 'your-actual-secret-value';
```

After running, disconnect and reconnect to the database (or restart) for the setting to take effect.

### 3. Verify Cron Job
The cron job `process-brand-stubs-5m` runs every 5 minutes and includes the `x-cron-secret` header.

Check it exists:
```sql
SELECT jobname, schedule FROM cron.job WHERE jobname = 'process-brand-stubs-5m';
```

### How It Works

1. The cron job calls `process-brand-stubs` with header `x-cron-secret: <value from app.cron_secret>`
2. The edge function validates this header against its `CRON_SECRET` environment variable
3. If they don't match, the function returns 401 Unauthorized

### Verification

Test manually (should work with correct secret):
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

### Stage Tracking

The enrichment pipeline now writes these stages to `brands.enrichment_stage`:

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

The UI (`EnrichmentStageProgress` component) displays these stages in real-time on brand profile pages.
