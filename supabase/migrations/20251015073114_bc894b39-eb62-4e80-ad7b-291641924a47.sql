-- Mark events as test if they lack a primary source with canonical_url
UPDATE brand_events
SET is_test = TRUE
WHERE brand_id IN ('4965edf9-68f3-4465-88d1-168bc6cc189a', 'ced5176a-2adf-4a89-8070-33acd1f4188c')
  AND NOT EXISTS (
    SELECT 1 FROM event_sources es
    WHERE es.event_id = brand_events.event_id
      AND es.is_primary = TRUE
      AND es.canonical_url IS NOT NULL
  );