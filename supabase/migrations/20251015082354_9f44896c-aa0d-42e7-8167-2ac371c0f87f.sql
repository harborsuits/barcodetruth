-- Fix incorrect Wikidata QIDs for multiple brands

-- Doritos: Q736845 (French commune) → Q1760099 (Doritos brand)
UPDATE brands 
SET wikidata_qid = 'Q1760099', 
    description = NULL, 
    description_source = NULL 
WHERE id = '03524872-8201-44ac-a5f2-97800a2789ec';

-- Sprite: Q209409 (Spanish singer) → Q190397 (Sprite soft drink)
UPDATE brands 
SET wikidata_qid = 'Q190397', 
    description = NULL, 
    description_source = NULL 
WHERE id = '35dc418a-ea11-4da7-b504-26a45b890345';