-- Mark existing "Untitled event" entries as test data
UPDATE brand_events 
SET is_test = true
WHERE brand_id = '4965edf9-68f3-4465-88d1-168bc6cc189a'
  AND (title = 'Untitled event' OR title IS NULL);

-- Create index for is_test filtering if not exists
CREATE INDEX IF NOT EXISTS idx_brand_events_is_test 
ON brand_events(brand_id, is_test) 
WHERE is_test = false;