-- Phase 5: Deduplication + Source Independence Schema (Fixed)

-- 1) News organizations ownership table
CREATE TABLE IF NOT EXISTS public.news_orgs (
  domain TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'publisher',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.news_orgs ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read news_orgs"
ON public.news_orgs
FOR SELECT
USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage news_orgs"
ON public.news_orgs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed high-impact news organizations
INSERT INTO public.news_orgs (domain, owner, kind) VALUES
  ('apnews.com', 'AP', 'wire'),
  ('reuters.com', 'Reuters', 'wire'),
  ('bloomberg.com', 'Bloomberg', 'wire'),
  ('usatoday.com', 'Gannett', 'publisher'),
  ('latimes.com', 'Nexstar', 'publisher'),
  ('nytimes.com', 'NYT', 'publisher'),
  ('wsj.com', 'Dow Jones', 'publisher'),
  ('washingtonpost.com', 'WPO', 'publisher'),
  ('theguardian.com', 'Guardian Media Group', 'publisher'),
  ('cnn.com', 'Warner Bros Discovery', 'network'),
  ('bbc.com', 'BBC', 'network'),
  ('npr.org', 'NPR', 'network')
ON CONFLICT (domain) DO NOTHING;

-- 2) Add normalization columns to event_sources
ALTER TABLE public.event_sources
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS registrable_domain TEXT,
  ADD COLUMN IF NOT EXISTS domain_owner TEXT,
  ADD COLUMN IF NOT EXISTS domain_kind TEXT,
  ADD COLUMN IF NOT EXISTS title_fp TEXT,
  ADD COLUMN IF NOT EXISTS day_bucket DATE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_sources_domain ON public.event_sources(registrable_domain);
CREATE INDEX IF NOT EXISTS idx_event_sources_owner ON public.event_sources(domain_owner);
CREATE INDEX IF NOT EXISTS idx_event_sources_day_bucket ON public.event_sources(day_bucket);
CREATE INDEX IF NOT EXISTS idx_event_sources_title_fp ON public.event_sources(title_fp);

-- 3) Helper function for verification ranking (accepts TEXT)
CREATE OR REPLACE FUNCTION public.verification_rank(v TEXT)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT CASE LOWER($1)
    WHEN 'official' THEN 0
    WHEN 'corroborated' THEN 1
    ELSE 2
  END;
$$;

-- 4) Deduped evidence view (keeps best source per owner per day)
CREATE OR REPLACE VIEW public.brand_evidence_independent AS
WITH src AS (
  SELECT
    es.id AS source_id,
    es.event_id,
    COALESCE(es.canonical_url, es.source_url) AS url,
    es.registrable_domain,
    es.domain_owner,
    es.domain_kind,
    es.source_name,
    es.source_date,
    es.archive_url,
    es.quote AS snippet,
    es.day_bucket,
    be.brand_id,
    be.category,
    be.verification::TEXT AS verification
  FROM public.event_sources es
  JOIN public.brand_events be ON be.event_id = es.event_id
  WHERE es.source_url IS NOT NULL
),
ranked AS (
  SELECT *,
    ROW_NUMBER() OVER (
      PARTITION BY brand_id, category, domain_owner, day_bucket
      ORDER BY 
        public.verification_rank(verification),
        CASE domain_kind WHEN 'publisher' THEN 0 WHEN 'network' THEN 1 ELSE 2 END,
        source_date ASC NULLS LAST
    ) AS rnk
  FROM src
)
SELECT 
  source_id AS id,
  event_id,
  brand_id,
  category,
  verification,
  source_name,
  url AS source_url,
  archive_url,
  source_date,
  snippet,
  domain_owner,
  domain_kind,
  registrable_domain
FROM ranked
WHERE rnk = 1;