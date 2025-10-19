-- Allow service role to UPDATE brand_events when setting category_code
-- This fixes the reclassification function which runs as service role
CREATE POLICY "Service role can update category_code"
ON brand_events
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (category_code IS NOT NULL);