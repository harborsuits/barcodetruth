
-- Analytics sessions table
CREATE TABLE public.analytics_sessions (
  session_id TEXT PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  scan_count INTEGER NOT NULL DEFAULT 0,
  device_type TEXT,
  source TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Analytics events table
CREATE TABLE public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL REFERENCES public.analytics_sessions(session_id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  brand_id UUID,
  barcode TEXT,
  properties JSONB DEFAULT '{}'::jsonb
);

-- Indexes for querying
CREATE INDEX idx_analytics_events_session ON public.analytics_events(session_id);
CREATE INDEX idx_analytics_events_name ON public.analytics_events(event_name);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_brand ON public.analytics_events(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX idx_analytics_sessions_started ON public.analytics_sessions(started_at DESC);

-- RLS
ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own sessions/events
CREATE POLICY "Users can insert own sessions" ON public.analytics_sessions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions" ON public.analytics_sessions
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users can insert events" ON public.analytics_events
  FOR INSERT TO authenticated WITH CHECK (true);

-- Allow anon inserts for non-logged-in tracking
CREATE POLICY "Anon can insert sessions" ON public.analytics_sessions
  FOR INSERT TO anon WITH CHECK (user_id IS NULL);

CREATE POLICY "Anon can insert events" ON public.analytics_events
  FOR INSERT TO anon WITH CHECK (true);

-- Admin can read all
CREATE POLICY "Admins can read all sessions" ON public.analytics_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read all events" ON public.analytics_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
