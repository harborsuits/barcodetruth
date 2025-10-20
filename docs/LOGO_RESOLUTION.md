# Logo Resolution System

Automated logo fetching for brands using free sources first, with proper caching and idempotency.

## Architecture

### Resolution Strategy (cheapest → richer)
1. **Wikimedia Commons** (via Wikidata QID) - Free, high quality
2. **Direct Favicon** (`/favicon.ico`) - Free, often available
3. **DuckDuckGo IP3** - Free, reliable fallback
4. **Clearbit** (optional) - Only if you have ToS approval

### Storage
- Logos are downloaded and stored in Supabase Storage bucket `brand-logos`
- Public URLs are cached with 1-day TTL
- Tracked with metadata: `logo_source`, `logo_last_checked`, `logo_etag`

## Setup

### 1. Configure Internal Token (if not already set)

The batch function requires an internal token for security:

```sql
-- In Supabase SQL Editor or via migration
-- Generate a secure token: openssl rand -hex 32
UPDATE _secrets_internal 
SET val = '<YOUR_SECURE_TOKEN>' 
WHERE key = 'INTERNAL_FN_TOKEN';

-- Or insert if not exists
INSERT INTO _secrets_internal (key, val)
VALUES ('INTERNAL_FN_TOKEN', '<YOUR_SECURE_TOKEN>')
ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;
```

### 2. Schedule Cron Job (Daily at 3 AM)

```sql
SELECT cron.schedule(
  'batch-resolve-logos',
  '0 3 * * *', -- 3 AM daily
  $$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-resolve-logos',
    headers := jsonb_build_object(
      'x-internal-token', (SELECT val FROM _secrets_internal WHERE key = 'INTERNAL_FN_TOKEN'),
      'x-cron', '1',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### 3. Manual Trigger (for testing)

```bash
# Get your internal token from Supabase
INTERNAL_TOKEN="<your_token>"

curl -X POST \
  https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/batch-resolve-logos \
  -H "x-internal-token: $INTERNAL_TOKEN" \
  -H "x-cron: 1" \
  -H "Content-Type: application/json"
```

## Monitoring

### Check brands needing logos
```sql
SELECT COUNT(*) as needs_logos FROM v_brands_needing_logos;

-- See specific brands
SELECT name, website, logo_last_checked 
FROM v_brands_needing_logos 
LIMIT 20;
```

### View recent resolutions
```sql
SELECT 
  name, 
  logo_source, 
  logo_last_checked,
  logo_url
FROM brands
WHERE logo_url IS NOT NULL
ORDER BY logo_last_checked DESC
LIMIT 20;
```

### Success rate by source
```sql
SELECT 
  logo_source,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM brands
WHERE logo_source IS NOT NULL
GROUP BY logo_source
ORDER BY count DESC;
```

### Brands still missing logos (after attempts)
```sql
SELECT 
  name,
  website,
  logo_last_checked,
  AGE(now(), logo_last_checked) as last_attempt_age
FROM brands
WHERE logo_url IS NULL 
  AND logo_last_checked IS NOT NULL
ORDER BY logo_last_checked DESC
LIMIT 20;
```

## How It Works

### Batch Process (runs nightly)
1. Queries `v_brands_needing_logos` view (max 50 per run)
2. For each brand:
   - Normalizes website URL (adds `https://` if missing)
   - Tries resolution sources in order (free first)
   - Downloads logo and uploads to Storage
   - Updates brand with public URL and metadata
   - Sets `logo_last_checked` (even on failure, to avoid hammering)
3. Reports results: processed, resolved, failed, skipped

### Idempotency
- Brands are re-checked every 30 days (logos can change)
- Failed attempts are logged via `logo_last_checked`
- Storage uploads use `upsert: true` (no duplicates)
- 200ms delay between brands (polite to external services)

## Troubleshooting

### No logos being resolved
```sql
-- Check if cron is running
SELECT * FROM cron.job WHERE jobname = 'batch-resolve-logos';

-- Check recent cron runs
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'batch-resolve-logos')
ORDER BY start_time DESC
LIMIT 10;

-- Verify internal token is set
SELECT EXISTS(SELECT 1 FROM _secrets_internal WHERE key = 'INTERNAL_FN_TOKEN');
```

### Storage bucket issues
```sql
-- Verify bucket exists and is public
SELECT * FROM storage.buckets WHERE id = 'brand-logos';

-- Check storage policies
SELECT * FROM storage.policies WHERE bucket_id = 'brand-logos';
```

### Frontend fallback (if logo missing)
Always show a monogram fallback in the UI:
```tsx
<Avatar>
  <AvatarImage src={brand.logo_url} alt={brand.name} />
  <AvatarFallback>{brand.name[0]}</AvatarFallback>
</Avatar>
```

## Security

✅ **Internal auth required** - Uses `x-internal-token` + `x-cron` headers  
✅ **No service role in browser** - All calls are server-side (cron or edge)  
✅ **Storage isolation** - Logos in dedicated public bucket  
✅ **Rate limiting** - 200ms delay, 50 brands/run cap  
✅ **Fail-safe** - Missing config = unlimited (won't block)  

## Performance

- **50 brands per run** - Processes ~1500 brands/month
- **~200ms per brand** - ~10 seconds per batch
- **Free sources prioritized** - Minimizes paid API usage
- **Cached in Storage** - 1-day browser cache, CDN-friendly
