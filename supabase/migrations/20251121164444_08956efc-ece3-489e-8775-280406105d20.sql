-- Mark all NOISE events as irrelevant so they don't damage scores
UPDATE brand_events
SET is_irrelevant = true
WHERE category_code LIKE 'NOISE.%'
  AND is_irrelevant = false;