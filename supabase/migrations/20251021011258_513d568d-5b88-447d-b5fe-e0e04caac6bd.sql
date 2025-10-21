-- User submissions table for report/suggest functionality
CREATE TABLE IF NOT EXISTS public.user_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  event_id uuid NULL REFERENCES public.brand_events(event_id) ON DELETE SET NULL,
  kind text CHECK (kind IN ('report_issue','suggest_evidence')) NOT NULL,
  url text,
  note text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_submissions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users insert own submissions" 
  ON public.user_submissions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own submissions" 
  ON public.user_submissions 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins read all submissions" 
  ON public.user_submissions 
  FOR SELECT 
  USING (has_role(auth.uid(),'admin'::app_role));

-- Performance indexes for evidence queries
CREATE INDEX IF NOT EXISTS be_brand_date_idx
  ON public.brand_events (brand_id, event_date DESC)
  WHERE COALESCE(is_irrelevant, false) = false;

CREATE INDEX IF NOT EXISTS be_family_idx
  ON public.brand_events (brand_id, (split_part(category_code, '.', 1)), event_date DESC);

CREATE INDEX IF NOT EXISTS es_event_domain_idx
  ON public.event_sources (event_id, registrable_domain);

-- Create brand_monitoring_status view for data confidence
CREATE OR REPLACE VIEW public.brand_monitoring_status AS
SELECT 
  b.id AS brand_id,
  b.name,
  b.last_news_ingestion AS last_ingest_at,
  CASE 
    WHEN b.last_news_ingestion IS NULL THEN 'never'
    WHEN b.last_news_ingestion >= NOW() - INTERVAL '1 day' THEN 'recent'
    WHEN b.last_news_ingestion >= NOW() - INTERVAL '7 days' THEN 'stale'
    ELSE 'very_stale'
  END AS ingest_status,
  COALESCE(bdc.events_30d, 0) AS event_count,
  COALESCE(bdc.events_7d, 0) AS events_7d,
  COALESCE(bdc.events_30d, 0) AS events_30d,
  COALESCE(bdc.events_365d, 0) AS events_365d,
  COALESCE(bdc.verified_rate, 0) AS verified_rate,
  COALESCE(bdc.independent_sources, 0) AS independent_sources,
  COALESCE((SELECT COUNT(DISTINCT es.registrable_domain) 
            FROM brand_events be
            JOIN event_sources es ON es.event_id = be.event_id
            WHERE be.brand_id = b.id 
            AND be.event_date >= NOW() - INTERVAL '90 days'
            AND COALESCE(be.is_irrelevant, false) = false), 0) AS domains_90d,
  -- Categories covered (non-noise)
  COALESCE((
    SELECT ARRAY_AGG(DISTINCT split_part(category_code, '.', 1))
    FROM brand_events
    WHERE brand_id = b.id
    AND event_date >= NOW() - INTERVAL '365 days'
    AND category_code IS NOT NULL
    AND category_code NOT LIKE 'NOISE.%'
    AND COALESCE(is_irrelevant, false) = false
  ), ARRAY[]::text[]) AS categories_covered,
  -- Has significant events
  EXISTS (
    SELECT 1 FROM brand_events
    WHERE brand_id = b.id
    AND event_date >= NOW() - INTERVAL '365 days'
    AND category_code IS NOT NULL
    AND category_code NOT LIKE 'NOISE.%'
    AND COALESCE(is_irrelevant, false) = false
  ) AS has_significant_events,
  -- Completeness percent
  CASE 
    WHEN COALESCE(bdc.events_30d, 0) >= 20 THEN 100
    WHEN COALESCE(bdc.events_30d, 0) >= 10 THEN 50
    WHEN COALESCE(bdc.events_30d, 0) >= 5 THEN 25
    ELSE LEAST(100, (COALESCE(bdc.events_30d, 0)::numeric / 20.0 * 100)::integer)
  END AS completeness_percent,
  -- Confidence level
  CASE 
    WHEN COALESCE(bdc.events_30d, 0) >= 20 
         AND CARDINALITY((SELECT ARRAY_AGG(DISTINCT split_part(category_code, '.', 1))
                         FROM brand_events
                         WHERE brand_id = b.id
                         AND event_date >= NOW() - INTERVAL '365 days'
                         AND category_code IS NOT NULL
                         AND category_code NOT LIKE 'NOISE.%'
                         AND COALESCE(is_irrelevant, false) = false)) >= 3
         AND COALESCE(bdc.verified_rate, 0) >= 0.3 
    THEN 'high'
    WHEN COALESCE(bdc.events_30d, 0) >= 10 
         AND CARDINALITY((SELECT ARRAY_AGG(DISTINCT split_part(category_code, '.', 1))
                         FROM brand_events
                         WHERE brand_id = b.id
                         AND event_date >= NOW() - INTERVAL '365 days'
                         AND category_code IS NOT NULL
                         AND category_code NOT LIKE 'NOISE.%'
                         AND COALESCE(is_irrelevant, false) = false)) >= 2
    THEN 'medium'
    WHEN COALESCE(bdc.events_30d, 0) >= 5 THEN 'low'
    ELSE 'none'
  END AS confidence_level
FROM brands b
LEFT JOIN brand_data_coverage bdc ON bdc.brand_id = b.id;