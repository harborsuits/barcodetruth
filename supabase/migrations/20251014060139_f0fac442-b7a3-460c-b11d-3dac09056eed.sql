-- TICKET D: Brand coverage refresh function
-- Aggregates events and updates brand_data_coverage

CREATE OR REPLACE FUNCTION public.refresh_brand_coverage()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update brand_data_coverage with aggregated event data
  INSERT INTO brand_data_coverage (
    brand_id,
    events_90d,
    events_365d,
    verified_rate,
    independent_sources,
    last_event_at
  )
  SELECT
    be.brand_id,
    COUNT(*) FILTER (WHERE be.event_date >= NOW() - INTERVAL '90 days') AS events_90d,
    COUNT(*) FILTER (WHERE be.event_date >= NOW() - INTERVAL '365 days') AS events_365d,
    COALESCE(
      AVG(CASE 
        WHEN be.verification = 'official' THEN 1.0
        WHEN be.verification = 'corroborated' THEN 0.8
        ELSE 0.4
      END),
      0
    ) AS verified_rate,
    COUNT(DISTINCT COALESCE(es.domain_owner, es.source_name)) AS independent_sources,
    MAX(be.event_date) AS last_event_at
  FROM brand_events be
  LEFT JOIN event_sources es ON es.event_id = be.event_id
  GROUP BY be.brand_id
  ON CONFLICT (brand_id) 
  DO UPDATE SET
    events_90d = EXCLUDED.events_90d,
    events_365d = EXCLUDED.events_365d,
    verified_rate = EXCLUDED.verified_rate,
    independent_sources = EXCLUDED.independent_sources,
    last_event_at = EXCLUDED.last_event_at;
END;
$$;