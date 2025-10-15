-- Fix Gillette's Wikidata QID to correct brand entity (Q123160974 = Gillette Company)
UPDATE brands 
SET wikidata_qid = 'Q123160974', 
    description = NULL, 
    description_source = NULL 
WHERE id = '86d3f579-9e6f-4d1e-95de-f97830092423';