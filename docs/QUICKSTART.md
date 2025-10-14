# Quickstart: 40% → 💯 in ~10 minutes

**Important:** Get your `INTERNAL_FN_TOKEN` first:
- Open Backend → Secrets (in Lovable)
- Copy the value of `INTERNAL_FN_TOKEN`
- Replace `YOUR_TOKEN_HERE` below with that value

---

## Step 1: Enable Extensions + Schedule Cron

**Run this SQL** (Lovable Backend → SQL Editor):

```sql
-- Enable once (safe to re-run)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1) Pull feeds every 15m
SELECT cron.schedule(
  'pull-feeds-15m','*/15 * * * *',$$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds',
    headers := jsonb_build_object('x-internal-token','YOUR_TOKEN_HERE','Content-Type','application/json'),
    body := '{}'::jsonb, 
    timeout_milliseconds := 30000
  ) AS request_id;
$$);

-- 2) Brand-match every 10m
SELECT cron.schedule(
  'brand-match-10m','*/10 * * * *',$$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match',
    headers := jsonb_build_object('x-internal-token','YOUR_TOKEN_HERE','Content-Type','application/json'),
    body := '{}'::jsonb, 
    timeout_milliseconds := 45000
  ) AS request_id;
$$);

-- 3) Resolve evidence every 15m
SELECT cron.schedule(
  'resolve-evidence-15m','*/15 * * * *',$$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300',
    headers := jsonb_build_object('x-internal-token','YOUR_TOKEN_HERE','Content-Type','application/json'),
    body := '{}'::jsonb, 
    timeout_milliseconds := 60000
  ) AS request_id;
$$);

-- 4) Recalculate scores nightly at 2:10 AM
SELECT cron.schedule(
  'calculate-baselines-nightly','10 2 * * *',$$
  SELECT net.http_post(
    url := 'https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines',
    headers := jsonb_build_object('x-internal-token','YOUR_TOKEN_HERE','Content-Type','application/json'),
    body := jsonb_build_object('mode','batch'), 
    timeout_milliseconds := 60000
  ) AS request_id;
$$);
```

**Verify:**
```sql
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobid;
```

---

## Step 2: Seed Products

**Run this SQL:**

```sql
-- Ensure fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);

-- Minimal test rows (replace with real UPC/EANs later)
INSERT INTO products (barcode, name, brand_id)
VALUES
  ('0000000000013','Sample Water 500ml', (SELECT id FROM brands WHERE name='Nestlé' LIMIT 1)),
  ('0000000000020','Sample Cola 12oz',   (SELECT id FROM brands WHERE name='Coca-Cola' LIMIT 1)),
  ('0000000000037','Sample Chips 8oz',   (SELECT id FROM brands WHERE name='Pepsi' LIMIT 1)),
  ('0000000000044','Sample Soap 3pk',    (SELECT id FROM brands WHERE name='Unilever' LIMIT 1)),
  ('0000000000051','Sample Detergent',   (SELECT id FROM brands WHERE name='P&G' LIMIT 1))
ON CONFLICT (barcode) DO NOTHING;
```

**Verify:**
```sql
SELECT COUNT(*) AS product_count,
       COUNT(*) FILTER (WHERE brand_id IS NOT NULL) AS products_with_brand
FROM products;

SELECT barcode, name, (SELECT name FROM brands b WHERE b.id=brand_id) AS brand
FROM products
ORDER BY created_at DESC NULLS LAST
LIMIT 10;
```

---

## Step 3: Prime the Pump (Manual Run)

**Run these in Terminal** (replace `YOUR_TOKEN_HERE` with your actual token):

```bash
export TOKEN=YOUR_TOKEN_HERE

# Pull articles from feeds
curl -sS -X POST -H "x-internal-token: $TOKEN" \
  https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/pull-feeds

# Match articles to brands
curl -sS -X POST -H "x-internal-token: $TOKEN" \
  https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/brand-match

# Resolve homepages → permalinks
curl -sS -X POST -H "x-internal-token: $TOKEN" \
  "https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/resolve-evidence-links?mode=agency-first&limit=300"

# Compute scores
curl -sS -X POST -H "x-internal-token: $TOKEN" \
  -H "Content-Type: application/json" -d '{"mode":"batch"}' \
  https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/calculate-baselines
```

**Verify (run in SQL Editor):**

```sql
-- New RSS items ingested?
SELECT status, COUNT(*) 
FROM rss_items
WHERE created_at > NOW() - INTERVAL '2 hours'
GROUP BY status;

-- New evidence/events created?
SELECT COUNT(*) AS recent_event_sources
FROM event_sources
WHERE created_at > NOW() - INTERVAL '2 hours';

SELECT COUNT(*) AS recent_brand_events
FROM brand_events
WHERE created_at > NOW() - INTERVAL '2 hours';

-- Scores updated?
SELECT COUNT(*) AS fresh_scores
FROM brand_scores
WHERE updated_at > NOW() - INTERVAL '24 hours';
```

---

## Step 4: Test the Customer Journey

1. **Open the scanner** (camera or upload)
2. **Scan one of the test barcodes** above (e.g., `0000000000013`)
3. **Verify the result page shows:**
   - Brand name + overall & category scores
   - Evidence timeline with "View Article / View Database / Archived"
   - "Why this score?" section populated
   - Alternatives drawer opens

4. **Test search:**
   - Search for a top brand name
   - Try a typo to confirm fuzzy matching works

---

## Troubleshooting

| Problem | Quick Fix |
|---------|-----------|
| No new evidence | Re-run `pull-feeds` + `brand-match`; check feeds are business/consumer-focused |
| Permalinks not showing | Re-run `resolve-evidence-links`; ensure `link_kind` is set |
| Scores stale | Re-run `calculate-baselines` |
| Scanner returns nothing | That barcode isn't in `products` table—add it |
| Cron not running | Check `SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;` |

---

## You're Done! 🎉

At this point:
- ✅ Automation is running (cron jobs scheduled)
- ✅ Products are seeded (scanner works)
- ✅ Data pipeline is primed (events → evidence → scores)
- ✅ Customer journey is validated (scan → detail → alternatives)

**Next:** Replace test barcodes with real UPC/EANs and let the system run for 24h to accumulate data.
