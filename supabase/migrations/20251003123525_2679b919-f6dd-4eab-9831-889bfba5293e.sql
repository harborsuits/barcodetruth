
-- Add is_test flag to brands table for safe test isolation
ALTER TABLE brands 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT false;

-- Mark the test brand
UPDATE brands 
SET is_test = true 
WHERE name = 'TEST_BRAND_DELETE_ME';

-- Index for filtering out test brands in production queries
CREATE INDEX IF NOT EXISTS idx_brands_is_test ON brands(is_test) WHERE is_test = false;
