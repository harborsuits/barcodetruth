-- ============================================
-- Evidence Pipeline Completion Migration
-- Adds indexes, tables, and DB functions for:
-- - Smart quote extraction
-- - Corroboration upgrade
-- - Fact extraction
-- - Manual source ingestion
-- ============================================

-- Create verification audit table
CREATE TABLE IF NOT EXISTS public.verification_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.brand_events(event_id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.verification_audit ENABLE ROW LEVEL SECURITY;

-- Admin can read/write audit logs
CREATE POLICY "Admins can manage verification audit"
  ON public.verification_audit
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for corroboration scanning
CREATE INDEX IF NOT EXISTS idx_sources_recent 
  ON public.event_sources(source_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_sources_event 
  ON public.event_sources(event_id);

CREATE INDEX IF NOT EXISTS idx_be_brand_cat_date 
  ON public.brand_events(brand_id, category, occurred_at DESC NULLS LAST);

-- Unique index for canonical URL deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_event_sources_url_canonical 
  ON public.event_sources((lower(canonical_url)))
  WHERE canonical_url IS NOT NULL;

-- Index for verification audit
CREATE INDEX IF NOT EXISTS idx_verification_audit_event 
  ON public.verification_audit(event_id, created_at DESC);

-- Function to get corroboration clusters
-- Returns events with ≥2 independent domains within 7 days
CREATE OR REPLACE FUNCTION public.get_corroboration_clusters(
  min_domains INT DEFAULT 2,
  min_credibility NUMERIC DEFAULT 0.60,
  window_days INT DEFAULT 7
)
RETURNS TABLE(
  brand_id UUID,
  category event_category,
  day DATE,
  title_fp TEXT,
  domains TEXT[],
  domain_count INT,
  avg_cred NUMERIC,
  event_ids UUID[]
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    be.brand_id,
    be.category,
    DATE(es.source_date) AS day,
    LEFT(MD5(LOWER(REGEXP_REPLACE(COALESCE(es.title_fp, ''), '[^a-z0-9 ]', '', 'gi'))), 16) AS title_fp,
    ARRAY_AGG(DISTINCT es.registrable_domain ORDER BY es.registrable_domain) AS domains,
    COUNT(DISTINCT es.registrable_domain) AS domain_count,
    AVG(
      COALESCE(
        (SELECT sc.base_credibility + COALESCE(sc.dynamic_adjustment, 0)
         FROM source_credibility sc
         WHERE sc.source_name = es.registrable_domain
         LIMIT 1),
        0.50
      )
    ) AS avg_cred,
    ARRAY_AGG(DISTINCT be.event_id) AS event_ids
  FROM event_sources es
  JOIN brand_events be ON be.event_id = es.event_id
  WHERE es.source_date >= now() - (window_days || ' days')::INTERVAL
    AND be.verification = 'unverified'
  GROUP BY 1, 2, 3, 4
  HAVING 
    COUNT(DISTINCT es.registrable_domain) >= min_domains
    AND AVG(
      COALESCE(
        (SELECT sc.base_credibility + COALESCE(sc.dynamic_adjustment, 0)
         FROM source_credibility sc
         WHERE sc.source_name = es.registrable_domain
         LIMIT 1),
        0.50
      )
    ) >= min_credibility;
$$;

-- Grant execute to authenticated users (edge functions use service role)
GRANT EXECUTE ON FUNCTION public.get_corroboration_clusters TO authenticated;

-- Schedule nightly corroboration upgrade job at 3:15 AM UTC
SELECT cron.schedule(
  'upgrade-corroboration-nightly',
  '15 3 * * *',
  $$
  SELECT net.http_post(
    url:='https://midmvcwtywnexzdwbekp.supabase.co/functions/v1/upgrade-corroboration',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pZG12Y3d0eXduZXh6ZHdiZWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDgyNDAsImV4cCI6MjA3NDgyNDI0MH0.Pf-m3_22yCh1H2Utja1vszTFYmB4dHj90RsYzR_QmoE"}'::jsonb
  ) as request_id;
  $$
);

-- Comment for documentation
COMMENT ON FUNCTION public.get_corroboration_clusters IS 
  'Returns event clusters with ≥min_domains independent sources within window_days, for corroboration upgrade';

COMMENT ON TABLE public.verification_audit IS 
  'Audit trail for verification status changes (unverified → corroborated → official)';