
-- Brand Display Profiles: canonical display-ready data for UI consumption
CREATE TABLE public.brand_display_profiles (
  brand_id UUID PRIMARY KEY REFERENCES public.brands(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  logo_url TEXT,
  logo_source TEXT,
  logo_status TEXT NOT NULL DEFAULT 'missing',
  parent_display_name TEXT,
  category_label TEXT,
  summary TEXT,
  score_state TEXT NOT NULL DEFAULT 'unseen',
  profile_status TEXT NOT NULL DEFAULT 'building',
  profile_completeness SMALLINT NOT NULL DEFAULT 0,
  website TEXT,
  last_enriched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Brand Enrichment Issues: queue of data quality problems to resolve
CREATE TABLE public.brand_enrichment_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  detected_value TEXT,
  proposed_fix TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brand_enrichment_issues_brand ON public.brand_enrichment_issues(brand_id);
CREATE INDEX idx_brand_enrichment_issues_unresolved ON public.brand_enrichment_issues(issue_type) WHERE resolved_at IS NULL;
CREATE INDEX idx_brand_display_profiles_status ON public.brand_display_profiles(profile_status);
CREATE INDEX idx_brand_display_profiles_completeness ON public.brand_display_profiles(profile_completeness);

-- RLS: public read, service-role write
ALTER TABLE public.brand_display_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_enrichment_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read display profiles"
  ON public.brand_display_profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can read enrichment issues"
  ON public.brand_enrichment_issues FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role manages display profiles"
  ON public.brand_display_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role manages enrichment issues"
  ON public.brand_enrichment_issues FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
