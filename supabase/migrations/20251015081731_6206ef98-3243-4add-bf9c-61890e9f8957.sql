-- Fix Gillette's incorrect Wikidata QID (was pointing to Bergman film instead of razor brand)
UPDATE brands 
SET wikidata_qid = 'Q223762', 
    description = NULL, 
    description_source = NULL 
WHERE id = '86d3f579-9e6f-4d1e-95de-f97830092423';