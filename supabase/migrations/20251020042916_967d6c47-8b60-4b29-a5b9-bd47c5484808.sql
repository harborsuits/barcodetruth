-- Fix brand_profile_view to include event_id in evidence
CREATE OR REPLACE FUNCTION brand_profile_view(p_brand_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'brand', jsonb_build_object(
      'id', b.id,
      'name', b.name,
      'website', b.website,
      'logo_url', b.logo_url,
      'description', b.description,
      'parent_company', b.parent_company,
      'logo_attribution', b.logo_attribution,
      'description_source', b.description_source
    ),
    'score', jsonb_build_object(
      'score', COALESCE(bs.score, 50),
      'score_labor', COALESCE(bs.score_labor, 50),
      'score_social', COALESCE(bs.score_social, 50),
      'score_politics', COALESCE(bs.score_politics, 50),
      'score_environment', COALESCE(bs.score_environment, 50),
      'updated_at', bs.last_updated,
      'reason_json', bs.reason_json
    ),
    'coverage', jsonb_build_object(
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
    ),
    'evidence', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'event_id', be2.event_id,
          'title', be2.title,
          'category', be2.category,
          'category_code', be2.category_code,
          'event_date', be2.event_date,
          'source_name', COALESCE(es2.source_name, 'Unknown'),
          'verification', be2.verification,
          'canonical_url', es2.canonical_url
        )
      )
      FROM brand_events be2
      LEFT JOIN LATERAL (
        SELECT source_name, canonical_url
        FROM event_sources
        WHERE event_id = be2.event_id
        ORDER BY is_primary DESC, created_at ASC
        LIMIT 1
      ) es2 ON true
      WHERE be2.brand_id = p_brand_id
        AND be2.event_date >= NOW() - INTERVAL '90 days'
      ORDER BY be2.event_date DESC
      LIMIT 50
      ),
      '[]'::jsonb
    )
  ) INTO result
  FROM brands b
  LEFT JOIN brand_scores bs ON bs.brand_id = b.id
  LEFT JOIN brand_events be ON be.brand_id = b.id AND be.event_date >= NOW() - INTERVAL '365 days'
  LEFT JOIN event_sources es ON es.event_id = be.event_id
  WHERE b.id = p_brand_id
  GROUP BY b.id, b.name, b.website, b.logo_url, b.description, b.parent_company, 
           b.logo_attribution, b.description_source, bs.score, bs.score_labor, 
           bs.score_social, bs.score_politics, bs.score_environment, 
           bs.last_updated, bs.reason_json;

  RETURN result;
END;
$$;