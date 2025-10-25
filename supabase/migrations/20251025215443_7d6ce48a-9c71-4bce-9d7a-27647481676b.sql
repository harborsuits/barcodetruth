
-- Fix self-referential parent companies where parent QID = brand QID
-- This happens when brands don't have P749 in Wikidata and enrichment fell back to brand itself

BEGIN;

-- Delete company_ownership records where parent company's wikidata_qid matches brand's wikidata_qid
-- These are self-referential and incorrect
DELETE FROM company_ownership co
WHERE EXISTS (
  SELECT 1
  FROM brands b
  JOIN companies c ON c.id = co.parent_company_id
  WHERE co.child_brand_id = b.id
  AND b.wikidata_qid = c.wikidata_qid
  AND b.wikidata_qid IS NOT NULL
);

-- Delete orphaned company records that were created for self-referential relationships
-- These companies have the same wikidata_qid as a brand and no other ownership records
DELETE FROM companies c
WHERE EXISTS (
  SELECT 1 FROM brands b
  WHERE b.wikidata_qid = c.wikidata_qid
  AND b.wikidata_qid IS NOT NULL
)
AND NOT EXISTS (
  SELECT 1 FROM company_ownership co
  WHERE co.parent_company_id = c.id
  OR co.child_company_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM company_people cp
  WHERE cp.company_id = c.id
)
AND NOT EXISTS (
  SELECT 1 FROM company_shareholders cs
  WHERE cs.company_id = c.id
);

COMMIT;
