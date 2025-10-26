-- Create SQL function to identify incomplete brands for system-wide health checks

CREATE OR REPLACE FUNCTION get_incomplete_brands()
RETURNS TABLE (
  id uuid,
  name text,
  wikidata_qid text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id, 
    b.name, 
    b.wikidata_qid
  FROM brands b
  WHERE b.wikidata_qid IS NOT NULL
    AND b.is_active = true
    AND (
      -- Missing corporate family (no ownership record)
      NOT EXISTS (
        SELECT 1 
        FROM company_ownership co 
        WHERE co.child_brand_id = b.id
      )
      -- OR missing key people
      OR NOT EXISTS (
        SELECT 1 
        FROM company_people cp
        JOIN companies c ON c.id = cp.company_id
        JOIN company_ownership co ON co.parent_company_id = c.id
        WHERE co.child_brand_id = b.id
      )
      -- OR missing shareholders
      OR NOT EXISTS (
        SELECT 1
        FROM company_shareholders cs
        JOIN companies c ON c.id = cs.company_id
        JOIN company_ownership co ON co.parent_company_id = c.id
        WHERE co.child_brand_id = b.id
      )
      -- OR missing logo
      OR b.logo_url IS NULL
      -- OR missing description
      OR b.description IS NULL
      -- OR low event count (less than 5 events in last 90 days)
      OR (
        SELECT COUNT(*) 
        FROM brand_events e 
        WHERE e.brand_id = b.id
          AND e.event_date >= NOW() - INTERVAL '90 days'
          AND e.is_irrelevant = false
      ) < 5
    )
  ORDER BY b.created_at DESC
  LIMIT 100; -- Process max 100 brands at a time
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION get_incomplete_brands() IS 
  'Identifies brands that need enrichment. Used by health-check-all-brands edge function for system-wide maintenance.';

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION get_incomplete_brands() TO service_role;
