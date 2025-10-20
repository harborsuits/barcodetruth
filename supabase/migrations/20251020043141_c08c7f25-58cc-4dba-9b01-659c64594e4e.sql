-- Fix brand_profile_view GROUP BY issue
CREATE OR REPLACE FUNCTION brand_profile_view(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  brand_data JSONB;
  score_data JSONB;
  coverage_data JSONB;
  evidence_data JSONB;
BEGIN
  -- Get brand info
  SELECT jsonb_build_object(
    'id', b.id,
    'name', b.name,
    'website', b.website,
    'logo_url', b.logo_url,
    'description', b.description,
    'parent_company', b.parent_company,
    'logo_attribution', b.logo_attribution,
    'description_source', b.description_source
  ) INTO brand_data
  FROM brands b
  WHERE b.id = p_brand_id;

  -- Get score info
  SELECT jsonb_build_object(
    'score', COALESCE(bs.score, 50),
    'score_labor', COALESCE(bs.score_labor, 50),
    'score_social', COALESCE(bs.score_social, 50),
    'score_politics', COALESCE(bs.score_politics, 50),
    'score_environment', COALESCE(bs.score_environment, 50),
    'updated_at', bs.last_updated,
    'reason_json', bs.reason_json
  ) INTO score_data
  FROM brand_scores bs
  WHERE bs.brand_id = p_brand_id
  ORDER BY bs.last_updated DESC
  LIMIT 1;

  -- Get coverage stats
  SELECT jsonb_build_object(
    'events_7d', COUNT(DISTINCT CASE WHEN be.event_date >= NOW() - INTERVAL '7 days' THEN be.event_id END),
    'events_30d', COUNT(DISTINCT CASE WHEN be.event_date >= NOW() - INTERVAL '30 days' THEN be.event_id END),
    'events_90d', COUNT(DISTINCT CASE WHEN be.event_date >= NOW() - INTERVAL '90 days' THEN be.event_id END),
    'events_365d', COUNT(DISTINCT CASE WHEN be.event_date >= NOW() - INTERVAL '365 days' THEN be.event_id END),
    'last_event_at', MAX(be.event_date),
    'verified_rate', 
      CASE 
        WHEN COUNT(be.event_id) > 0 
        THEN ROUND(COUNT(CASE WHEN be.verification = 'official' THEN 1 END)::numeric / COUNT(be.event_id)::numeric, 2)
        ELSE 0 
      END,
    'independent_sources', COUNT(DISTINCT es.domain_owner)
  ) INTO coverage_data
  FROM brand_events be
  LEFT JOIN event_sources es ON es.event_id = be.event_id
  WHERE be.brand_id = p_brand_id
    AND be.event_date >= NOW() - INTERVAL '365 days';

  -- Get evidence list
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'event_id', be.event_id,
      'title', be.title,
      'category', be.category,
      'category_code', be.category_code,
      'event_date', be.event_date,
      'source_name', COALESCE(es.source_name, 'Unknown'),
      'verification', be.verification,
      'canonical_url', es.canonical_url
    ) ORDER BY be.event_date DESC
  ), '[]'::jsonb) INTO evidence_data
  FROM brand_events be
  LEFT JOIN LATERAL (
    SELECT source_name, canonical_url
    FROM event_sources
    WHERE event_id = be.event_id
    ORDER BY is_primary DESC, created_at ASC
    LIMIT 1
  ) es ON true
  WHERE be.brand_id = p_brand_id
    AND be.event_date >= NOW() - INTERVAL '90 days'
  LIMIT 50;

  -- Combine all data
  result := jsonb_build_object(
    'brand', brand_data,
    'score', score_data,
    'coverage', coverage_data,
    'evidence', evidence_data
  );

  RETURN result;
END;
$$;