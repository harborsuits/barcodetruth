-- Fix overly permissive RLS policies on processing_queue table
-- Restrict access to service role and admins only

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "queue_read" ON processing_queue;
DROP POLICY IF EXISTS "queue_write_service" ON processing_queue;
DROP POLICY IF EXISTS "queue_update_service" ON processing_queue;

-- Service role has full access (for Edge Functions)
CREATE POLICY "Service role manages queue"
  ON processing_queue FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Admins can view the queue for monitoring purposes
CREATE POLICY "Admins can view queue"
  ON processing_queue FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));