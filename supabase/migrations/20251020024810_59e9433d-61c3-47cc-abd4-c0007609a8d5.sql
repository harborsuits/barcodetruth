-- Create company_profile_feed view for UI consumption
-- Shows accepted events (passed relevance gate) from last 90 days

CREATE OR REPLACE VIEW company_profile_feed AS
SELECT 
  e.event_id,
  e.brand_id,
  e.title,
  e.description,
  e.category,
  e.category_code,
  e.verification,
  e.event_date,
  e.occurred_at,
  e.relevance_score_raw,
  e.orientation,
  e.severity,
  e.source_url,
  e.created_at,
  e.updated_at
FROM brand_events e
WHERE e.is_irrelevant = false
  AND e.relevance_score_raw >= 11
  AND e.event_date >= NOW() - INTERVAL '90 days';

-- Grant read access
GRANT SELECT ON company_profile_feed TO authenticated;
GRANT SELECT ON company_profile_feed TO anon;