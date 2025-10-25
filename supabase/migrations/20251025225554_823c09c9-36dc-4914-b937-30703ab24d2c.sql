-- Create function to get brands with event counts for fair allocation
CREATE OR REPLACE FUNCTION get_brands_with_event_counts()
RETURNS TABLE (
  id uuid,
  name text,
  wikidata_qid text,
  event_count bigint,
  last_ingestion timestamp with time zone
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.wikidata_qid,
    COUNT(DISTINCT e.event_id) as event_count,
    b.last_news_ingestion
  FROM brands b
  LEFT JOIN brand_events e ON e.brand_id = b.id AND e.is_test = false
  WHERE b.is_active = true 
    AND b.wikidata_qid IS NOT NULL
  GROUP BY b.id, b.name, b.wikidata_qid, b.last_news_ingestion
  ORDER BY event_count ASC, b.last_news_ingestion ASC NULLS FIRST, b.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;