-- Fix incorrect Wikipedia QIDs and clear wrong descriptions
-- These brands had wrong Wikipedia articles matched

UPDATE brands 
SET 
  description = NULL,
  description_source = NULL,
  wikidata_qid = CASE id
    WHEN '50941236-cdb4-423d-9c95-b9f1b85068f6' THEN 'Q4890971'  -- Ben & Jerry's (was Q326163 = Breaststroke)
    WHEN '3a7ee66f-a267-448b-a209-a04935637a67' THEN 'Q1423446'  -- Colgate-Palmolive (was Q1112480 = Columbia Heights)
    WHEN '95e81a6c-042d-4fb5-8ee6-3526545509c6' THEN 'Q1139921'  -- Coty Inc. (was Q1136856 = Cotyledon plant)
    WHEN '03524872-8201-44ac-a5f2-97800a2789ec' THEN 'Q861476'   -- Doritos (was Q1760099 = Sarapuí city)
    WHEN '5c3d8125-5382-4b07-9598-d98daad2c32a' THEN 'Q386020'   -- Ferrero SpA (was Q21493848 = surname)
    WHEN '637fe027-611b-4863-b859-f6cccf3369e4' THEN 'Q251311'   -- General Mills (was Q641427 = Beilin Museum)
    WHEN 'a53d0cac-8292-48ba-bc35-009324ea5aa8' THEN 'Q657108'   -- Kellogg Company (was Q14915 = Tomato knife)
    WHEN '35dc418a-ea11-4da7-b504-26a45b890345' THEN 'Q278224'   -- Sprite drink (was Q190397 = Spring software)
    WHEN 'e0d8bf2d-1b71-461f-b67e-1201ab91f190' THEN 'Q1153376'  -- Tide detergent (was Q408790 = ocean Tides)
  END,
  updated_at = now()
WHERE id IN (
  '50941236-cdb4-423d-9c95-b9f1b85068f6', -- Ben & Jerry's
  '3a7ee66f-a267-448b-a209-a04935637a67', -- Colgate-Palmolive
  '95e81a6c-042d-4fb5-8ee6-3526545509c6', -- Coty
  '03524872-8201-44ac-a5f2-97800a2789ec', -- Doritos
  '5c3d8125-5382-4b07-9598-d98daad2c32a', -- Ferrero
  '637fe027-611b-4863-b859-f6cccf3369e4', -- General Mills
  'a53d0cac-8292-48ba-bc35-009324ea5aa8', -- Kellogg Company
  '35dc418a-ea11-4da7-b504-26a45b890345', -- Sprite
  'e0d8bf2d-1b71-461f-b67e-1201ab91f190'  -- Tide
);

-- Add comment for tracking
COMMENT ON TABLE brands IS 'Fixed 9 incorrect Wikipedia QIDs on 2025-01-21: Ben & Jerrys, Colgate-Palmolive, Coty, Doritos, Ferrero, General Mills, Kellogg, Sprite, Tide';
