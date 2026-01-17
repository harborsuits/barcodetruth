-- Create view for brand completeness scoring
CREATE OR REPLACE VIEW v_brand_completeness AS
SELECT 
  b.id,
  b.name,
  b.slug,
  b.status,
  b.description,
  b.logo_url,
  b.website,
  b.wikidata_qid,
  b.parent_company,
  b.enrichment_stage,
  b.created_at,
  -- Completeness flags
  (b.description IS NOT NULL AND b.description != '') as has_description,
  (b.logo_url IS NOT NULL AND b.logo_url != '') as has_logo,
  (b.website IS NOT NULL) as has_website,
  (b.wikidata_qid IS NOT NULL) as has_wikidata,
  -- Evidence count
  COALESCE(ev.evidence_count, 0) as evidence_count,
  COALESCE(ev.distinct_domains, 0) as distinct_domains,
  -- Score presence
  (bs.score_labor IS NOT NULL) as has_pillars,
  -- Tier calculation: Tier 1 if has description + (3+ evidence OR 2+ domains) + pillar scores
  CASE 
    WHEN b.description IS NOT NULL 
      AND b.description != '' 
      AND (COALESCE(ev.evidence_count, 0) >= 3 OR COALESCE(ev.distinct_domains, 0) >= 2)
      AND bs.score_labor IS NOT NULL 
    THEN 1 
    ELSE 0 
  END as tier
FROM brands b
LEFT JOIN (
  SELECT 
    brand_id, 
    COUNT(*) as evidence_count,
    COUNT(DISTINCT 
      CASE 
        WHEN source_url IS NOT NULL 
        THEN substring(source_url from 'https?://([^/]+)')
        ELSE NULL 
      END
    ) as distinct_domains
  FROM brand_events 
  WHERE is_irrelevant = false OR is_irrelevant IS NULL
  GROUP BY brand_id
) ev ON b.id = ev.brand_id
LEFT JOIN brand_scores bs ON b.id = bs.brand_id;

-- Create RPC function to get profile tier data
CREATE OR REPLACE FUNCTION get_brand_profile_tier(p_brand_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT jsonb_build_object(
    'tier', CASE WHEN vc.tier = 1 THEN 'full' ELSE 'preview' END,
    'completeness', jsonb_build_object(
      'has_description', vc.has_description,
      'has_logo', vc.has_logo,
      'has_website', vc.has_website,
      'has_wikidata', vc.has_wikidata,
      'evidence_count', vc.evidence_count,
      'distinct_domains', vc.distinct_domains,
      'has_pillars', vc.has_pillars
    ),
    'confidence', CASE 
      WHEN vc.evidence_count >= 5 AND vc.has_pillars THEN 'strong'
      WHEN vc.evidence_count >= 2 OR vc.has_description THEN 'growing'
      ELSE 'early'
    END,
    'enrichment_stage', vc.enrichment_stage,
    'created_at', vc.created_at,
    'parent_company', vc.parent_company
  )
  FROM v_brand_completeness vc
  WHERE vc.id = p_brand_id;
$$;

-- Grant access to the view and function
GRANT SELECT ON v_brand_completeness TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_brand_profile_tier(uuid) TO anon, authenticated;