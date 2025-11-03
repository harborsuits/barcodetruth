-- Fix Tesco brand missing wikidata_qid
UPDATE brands 
SET wikidata_qid = 'Q487494'
WHERE name = 'Tesco' 
  AND id = '2317f674-2d21-4a6d-afb7-fbb0ee3db89b'
  AND wikidata_qid IS NULL;