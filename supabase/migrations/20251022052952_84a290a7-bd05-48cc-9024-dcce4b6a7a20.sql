
-- Clear bad Wikidata/description data so we can re-enrich properly
-- Only clear brands with obviously wrong descriptions (sports events, tournaments, etc.)

UPDATE brands
SET 
  wikidata_qid = NULL,
  description = NULL,
  description_source = NULL
WHERE description LIKE '%World Cup%'
  OR description LIKE '%tournament%'
  OR description LIKE '%championship%'
  OR description LIKE '%FIFA%'
  OR description LIKE '%Olympic%'
  OR (description_source = 'wikipedia' AND LENGTH(description) < 100);

-- Log what we're clearing
SELECT 
  id,
  name,
  LEFT(description, 100) as description_preview,
  wikidata_qid
FROM brands
WHERE wikidata_qid IS NULL
  AND description IS NULL
  AND is_active = true
LIMIT 10;
