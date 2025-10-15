-- Update brand_profile_view RPC to include description and logo fields
CREATE OR REPLACE FUNCTION public.brand_profile_view(p_brand_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH b AS (
    SELECT id, name, parent_company, website, description, description_source, logo_url, logo_attribution
    FROM brands 
    WHERE id = p_brand_id
  ),
  s AS (
    SELECT 
      score_labor AS score,
      last_updated AS updated_at,
      breakdown AS reason_json
    FROM brand_scores 
    WHERE brand_id = p_brand_id
    ORDER BY last_updated DESC
    LIMIT 1
  ),
  c AS (
    SELECT 
      COALESCE(events_90d, 0) AS events_90d,
      COALESCE(events_365d, 0) AS events_365d,
      COALESCE(verified_rate, 0) AS verified_rate,
      COALESCE(independent_sources, 0) AS independent_sources,
      last_event_at
    FROM brand_data_coverage 
    WHERE brand_id = p_brand_id
  ),
  events_30d_calc AS (
    SELECT COUNT(*) AS cnt
    FROM brand_events
    WHERE brand_id = p_brand_id
      AND created_at >= NOW() - INTERVAL '30 days'
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
        'events_30d', COALESCE((SELECT cnt FROM events_30d_calc), 0),
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
$function$;