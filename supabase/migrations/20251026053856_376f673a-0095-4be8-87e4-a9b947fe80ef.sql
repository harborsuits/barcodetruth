
-- Function to find brands with ownership but no key people
CREATE OR REPLACE FUNCTION get_brands_missing_key_people()
RETURNS TABLE (
  id UUID,
  name TEXT,
  wikidata_qid TEXT,
  parent_company_id UUID
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.wikidata_qid,
    co.parent_company_id
  FROM brands b
  JOIN company_ownership co ON co.child_brand_id = b.id
  WHERE b.wikidata_qid IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM company_people cp 
    WHERE cp.company_id = co.parent_company_id
  )
  ORDER BY b.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
