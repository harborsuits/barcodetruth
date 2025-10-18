-- Ensure all impact and classification columns exist
ALTER TABLE public.brand_events
  ADD COLUMN IF NOT EXISTS impact_labor        smallint,
  ADD COLUMN IF NOT EXISTS impact_environment  smallint,
  ADD COLUMN IF NOT EXISTS impact_politics     smallint,
  ADD COLUMN IF NOT EXISTS impact_social       smallint,
  ADD COLUMN IF NOT EXISTS impact_confidence   smallint,
  ADD COLUMN IF NOT EXISTS relevance_score     smallint,
  ADD COLUMN IF NOT EXISTS is_press_release    boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS disambiguation_reason text;

-- Add constraints if not already present (will fail silently if exists)
DO $$ 
BEGIN
  ALTER TABLE public.brand_events
    ADD CONSTRAINT be_impact_bounds CHECK (
      (impact_labor        BETWEEN -5 AND 5 OR impact_labor        IS NULL) AND
      (impact_environment  BETWEEN -5 AND 5 OR impact_environment  IS NULL) AND
      (impact_politics     BETWEEN -5 AND 5 OR impact_politics     IS NULL) AND
      (impact_social       BETWEEN -5 AND 5 OR impact_social       IS NULL) AND
      (impact_confidence   BETWEEN  0 AND 100 OR impact_confidence IS NULL) AND
      (relevance_score     BETWEEN  0 AND 20  OR relevance_score   IS NULL)
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Performance indexes
CREATE INDEX IF NOT EXISTS be_brand_date_idx ON public.brand_events(brand_id, event_date DESC);
CREATE INDEX IF NOT EXISTS be_brand_cat_idx  ON public.brand_events(brand_id, category);
CREATE INDEX IF NOT EXISTS be_rel_idx        ON public.brand_events(relevance_score);

-- Update brand_profile_view to include sources_count and correct coverage fields
CREATE OR REPLACE FUNCTION public.brand_profile_view(p_brand_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH b AS (
    SELECT id, name, parent_company, website, description, description_source, logo_url, logo_attribution
    FROM brands 
    WHERE id = p_brand_id
  ),
  s AS (
    SELECT 
      score,
      score_labor,
      score_environment,
      score_politics,
      score_social,
      last_updated AS updated_at,
      breakdown AS reason_json
    FROM brand_scores 
    WHERE brand_id = p_brand_id
    ORDER BY last_updated DESC
    LIMIT 1
  ),
  c AS (
    SELECT
      COUNT(*) FILTER (WHERE be.event_date >= now() - INTERVAL '7 days') AS events_7d,
      COUNT(*) FILTER (WHERE be.event_date >= now() - INTERVAL '30 days') AS events_30d,
      COUNT(*) FILTER (WHERE be.event_date >= now() - INTERVAL '90 days') AS events_90d,
      COUNT(*) FILTER (WHERE be.event_date >= now() - INTERVAL '365 days') AS events_365d,
      ROUND(
        100.0 * 
        COUNT(*) FILTER (WHERE be.verification IN ('corroborated', 'official')) /
        NULLIF(COUNT(*), 0),
        1
      ) AS verified_rate,
      COUNT(DISTINCT es.canonical_url) AS independent_sources,
      MAX(be.event_date) AS last_event_at
    FROM brand_events be
    LEFT JOIN event_sources es ON es.event_id = be.event_id
    WHERE be.brand_id = p_brand_id
  ),
  e AS (
    SELECT
      be.event_date,
      COALESCE(be.title, 'Untitled event') AS title,
      be.verification::text AS verification,
      es.source_name,
      es.canonical_url,
      be.category::text AS category
    FROM brand_events be
    LEFT JOIN event_sources es ON es.event_id = be.event_id
    WHERE be.brand_id = p_brand_id
    ORDER BY be.event_date DESC NULLS LAST
    LIMIT 25
  )
  SELECT jsonb_build_object(
    'brand', (SELECT COALESCE(to_jsonb(b.*), 'null'::jsonb) FROM b),
    'score', (SELECT COALESCE(to_jsonb(s.*), 'null'::jsonb) FROM s),
    'coverage', (
      SELECT jsonb_build_object(
        'events_7d', COALESCE(c.events_7d, 0),
        'events_30d', COALESCE(c.events_30d, 0),
        'events_90d', COALESCE(c.events_90d, 0),
        'events_365d', COALESCE(c.events_365d, 0),
        'verified_rate', COALESCE(c.verified_rate, 0),
        'independent_sources', COALESCE(c.independent_sources, 0),
        'last_event_at', c.last_event_at
      )
      FROM c
    ),
    'evidence', (SELECT COALESCE(jsonb_agg(to_jsonb(e.*)), '[]'::jsonb) FROM e)
  );
$$;