-- Fix Mondelez International - was incorrectly matched to Norwegian football club
UPDATE brands 
SET 
  description = NULL,
  description_source = NULL,
  wikidata_qid = 'Q1115718',  -- Correct: Mondelez International (was Q837205 = Kongsvinger IL football club)
  updated_at = now()
WHERE id = '393e0bae-4d41-44bc-b248-fdb51c4aaaa0';
