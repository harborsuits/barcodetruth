-- Fix RLS: Allow service role to insert events/sources
DROP POLICY IF EXISTS "Admins can insert events" ON brand_events;
DROP POLICY IF EXISTS "Admins can insert event sources" ON event_sources;

CREATE POLICY "Service role can insert events" ON brand_events
FOR INSERT TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can insert sources" ON event_sources
FOR INSERT TO service_role
WITH CHECK (true);

-- Keep admin insert capability too
CREATE POLICY "Admins can insert events" ON brand_events
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));