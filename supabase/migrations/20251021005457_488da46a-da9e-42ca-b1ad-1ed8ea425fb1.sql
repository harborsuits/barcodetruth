-- COMPREHENSIVE FIX: Clear all incorrect Wikipedia matches
-- These brands were matched to completely wrong Wikipedia articles

UPDATE brands 
SET 
  description = NULL,
  description_source = NULL,
  wikidata_qid = CASE id
    -- Previously fixed (keeping for completeness)
    WHEN '50941236-cdb4-423d-9c95-b9f1b85068f6' THEN 'Q4890971'   -- Ben & Jerry's
    WHEN '3a7ee66f-a267-448b-a209-a04935637a67' THEN 'Q1423446'   -- Colgate-Palmolive
    WHEN '95e81a6c-042d-4fb5-8ee6-3526545509c6' THEN 'Q1139921'   -- Coty Inc.
    WHEN '03524872-8201-44ac-a5f2-97800a2789ec' THEN 'Q861476'    -- Doritos
    WHEN '5c3d8125-5382-4b07-9598-d98daad2c32a' THEN 'Q386020'    -- Ferrero
    WHEN '637fe027-611b-4863-b859-f6cccf3369e4' THEN 'Q251311'    -- General Mills
    WHEN 'a53d0cac-8292-48ba-bc35-009324ea5aa8' THEN 'Q657108'    -- Kellogg
    WHEN '35dc418a-ea11-4da7-b504-26a45b890345' THEN 'Q278224'    -- Sprite
    WHEN 'e0d8bf2d-1b71-461f-b67e-1201ab91f190' THEN 'Q1153376'   -- Tide
    WHEN '393e0bae-4d41-44bc-b248-fdb51c4aaaa0' THEN 'Q1115718'   -- Mondelez
    -- New fixes discovered
    WHEN '3a0d71e6-5809-4a33-b1d3-1cbd9f7832b1' THEN 'Q13379'     -- KitKat (was Q210081 = Walters Museum)
    WHEN '56e0ef2a-0d31-43bc-a615-827a8838005a' THEN 'Q147662'    -- Zara (was Q4023853 = given name)
    WHEN 'dca50aec-af0d-4afb-812a-15ef77747b69' THEN 'Q7317264'   -- Kraft Heinz (was Q19903381 = film editor)
    WHEN '8b6e8259-db95-46b7-b139-2ea4312d0ea0' THEN 'Q1129823'   -- Lay's (was Q285053 = lady's companion)
    WHEN '9ab7c7a7-732e-46e4-90cb-46db90d50f91' THEN 'Q152888'    -- Mars Inc. (was Q127922 = radiative zone)
    WHEN 'a0f7067a-5e29-4163-ace1-74ae374919ac' THEN 'Q13255'     -- Oreo (was Q594857 = Spanish hurdler)
  END,
  updated_at = now()
WHERE id IN (
  -- All mismatched brands
  '50941236-cdb4-423d-9c95-b9f1b85068f6',
  '3a7ee66f-a267-448b-a209-a04935637a67',
  '95e81a6c-042d-4fb5-8ee6-3526545509c6',
  '03524872-8201-44ac-a5f2-97800a2789ec',
  '5c3d8125-5382-4b07-9598-d98daad2c32a',
  '637fe027-611b-4863-b859-f6cccf3369e4',
  'a53d0cac-8292-48ba-bc35-009324ea5aa8',
  '35dc418a-ea11-4da7-b504-26a45b890345',
  'e0d8bf2d-1b71-461f-b67e-1201ab91f190',
  '393e0bae-4d41-44bc-b248-fdb51c4aaaa0',
  '3a0d71e6-5809-4a33-b1d3-1cbd9f7832b1',
  '56e0ef2a-0d31-43bc-a615-827a8838005a',
  'dca50aec-af0d-4afb-812a-15ef77747b69',
  '8b6e8259-db95-46b7-b139-2ea4312d0ea0',
  '9ab7c7a7-732e-46e4-90cb-46db90d50f91',
  'a0f7067a-5e29-4163-ace1-74ae374919ac'
);

-- Log the comprehensive fix
COMMENT ON TABLE brands IS 'Comprehensive Wikipedia QID fix 2025-01-21: Fixed 16 incorrect matches including Ben & Jerrys, Colgate, Coty, Doritos, Ferrero, General Mills, Kellogg, Sprite, Tide, Mondelez, KitKat, Zara, Kraft Heinz, Lays, Mars, Oreo';
