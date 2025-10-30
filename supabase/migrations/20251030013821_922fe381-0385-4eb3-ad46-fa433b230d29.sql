-- Complete observability and seeding infrastructure

-- 1. Staging products table for CSV/OFF imports
CREATE TABLE IF NOT EXISTS staging_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode TEXT NOT NULL,
  product_name TEXT,
  brand_label TEXT,
  category TEXT,
  content_hash TEXT UNIQUE,
  inserted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staging_products_barcode ON staging_products(barcode);
CREATE INDEX IF NOT EXISTS idx_staging_products_brand_label ON staging_products(brand_label);

-- 2. Brand enrichment queue
CREATE TABLE IF NOT EXISTS brand_enrichment_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  task TEXT NOT NULL DEFAULT 'full',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts INTEGER DEFAULT 0,
  error_message TEXT,
  next_run_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, task)
);

CREATE INDEX IF NOT EXISTS idx_brand_enrichment_queue_status ON brand_enrichment_queue(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_brand_enrichment_queue_brand ON brand_enrichment_queue(brand_id);

-- 3. Seeding runs log
CREATE TABLE IF NOT EXISTS seeding_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL, -- 'csv' or 'openfoodfacts'
  staged INTEGER DEFAULT 0,
  merged INTEGER DEFAULT 0,
  queued INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  meta JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_seeding_runs_started ON seeding_runs(started_at DESC);

-- 4. Seeding errors log
CREATE TABLE IF NOT EXISTS seeding_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES seeding_runs(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  ref TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_seeding_errors_run ON seeding_errors(run_id);

-- 5. Unknown products tracking (for demand-based seeding)
CREATE TABLE IF NOT EXISTS unknown_products (
  barcode TEXT PRIMARY KEY,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  seen_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_unknown_products_seen ON unknown_products(seen_count DESC, last_seen DESC);

-- 6. Observability views

-- Daily Digest Preview
CREATE OR REPLACE VIEW digest_events_last_24h AS
SELECT
  b.id AS brand_id,
  b.name AS brand_name,
  COUNT(e.event_id) AS new_events,
  MIN(e.created_at) AS first_event,
  MAX(e.created_at) AS last_event,
  ARRAY_AGG(DISTINCT e.category::text) AS categories
FROM brand_events e
JOIN brands b ON b.id = e.brand_id
WHERE e.created_at > NOW() - INTERVAL '24 hours'
  AND e.is_irrelevant = false
GROUP BY b.id, b.name
ORDER BY new_events DESC;

-- Ingestion Metrics
CREATE OR REPLACE VIEW ingestion_metrics_daily AS
SELECT
  DATE_TRUNC('day', started_at) AS day,
  COUNT(*) AS runs,
  SUM(staged) AS total_staged,
  SUM(merged) AS total_merged,
  SUM(queued) AS total_queued,
  SUM(failed) AS total_failed,
  ROUND(AVG(merged::numeric / NULLIF(staged, 0)) * 100, 1) AS avg_merge_rate
FROM seeding_runs
WHERE started_at IS NOT NULL
GROUP BY 1
ORDER BY 1 DESC;

-- Enrichment Queue Health
CREATE OR REPLACE VIEW enrichment_queue_summary AS
SELECT
  status,
  COUNT(*) AS jobs,
  ROUND(AVG(attempts)::numeric, 1) AS avg_attempts,
  ROUND(AVG(EXTRACT(EPOCH FROM NOW() - created_at) / 60)::numeric, 1) AS avg_age_min,
  MIN(next_run_at) AS next_scheduled_run
FROM brand_enrichment_queue
GROUP BY status
ORDER BY status;

-- Top unknown products by demand
CREATE OR REPLACE VIEW top_unknown_products AS
SELECT
  barcode,
  seen_count,
  first_seen,
  last_seen,
  ROUND(EXTRACT(EPOCH FROM NOW() - last_seen) / 3600, 1) AS hours_since_last_seen
FROM unknown_products
ORDER BY seen_count DESC, last_seen DESC
LIMIT 100;

-- Brand alias suggestions (using pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE VIEW brand_alias_suggestions AS
WITH unmapped AS (
  SELECT brand_label, COUNT(*) AS product_count
  FROM staging_products
  WHERE brand_label IS NOT NULL
  GROUP BY 1
  ORDER BY 2 DESC
  LIMIT 50
)
SELECT 
  u.brand_label,
  b.id AS suggested_brand_id,
  b.name AS suggested_brand_name,
  SIMILARITY(b.name, u.brand_label) AS similarity_score,
  u.product_count
FROM unmapped u
CROSS JOIN brands b
WHERE SIMILARITY(b.name, u.brand_label) > 0.35
ORDER BY u.product_count DESC, similarity_score DESC;

-- Grant read access to authenticated users for observability views
GRANT SELECT ON digest_events_last_24h TO authenticated;
GRANT SELECT ON ingestion_metrics_daily TO authenticated;
GRANT SELECT ON enrichment_queue_summary TO authenticated;
GRANT SELECT ON top_unknown_products TO authenticated;
GRANT SELECT ON brand_alias_suggestions TO authenticated;

-- RLS policies (admin-only write access)
ALTER TABLE staging_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE seeding_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seeding_errors ENABLE ROW LEVEL SECURITY;
ALTER TABLE unknown_products ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read observability data
CREATE POLICY "Allow authenticated read on staging_products"
  ON staging_products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on enrichment_queue"
  ON brand_enrichment_queue FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on seeding_runs"
  ON seeding_runs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on seeding_errors"
  ON seeding_errors FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated read on unknown_products"
  ON unknown_products FOR SELECT
  TO authenticated
  USING (true);