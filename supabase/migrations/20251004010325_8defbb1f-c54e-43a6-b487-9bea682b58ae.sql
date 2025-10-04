-- Create dedicated function call log for rate limiting
CREATE TABLE IF NOT EXISTS public.fn_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  requester_ip TEXT,
  fn TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient rate limit queries
CREATE INDEX idx_fn_call_log_user_time ON public.fn_call_log(user_id, fn, created_at DESC);
CREATE INDEX idx_fn_call_log_ip_time ON public.fn_call_log(requester_ip, fn, created_at DESC);

-- Enable RLS
ALTER TABLE public.fn_call_log ENABLE ROW LEVEL SECURITY;

-- Admin read policy
CREATE POLICY "Admins can view all function calls"
ON public.fn_call_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Create summary cache table
CREATE TABLE IF NOT EXISTS public.event_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL,
  summary JSONB NOT NULL,
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_event FOREIGN KEY (event_id) REFERENCES public.brand_events(event_id) ON DELETE CASCADE
);

-- Index for cache lookups
CREATE UNIQUE INDEX idx_event_summaries_event ON public.event_summaries(event_id);

-- Enable RLS
ALTER TABLE public.event_summaries ENABLE ROW LEVEL SECURITY;

-- Public read policy (summaries are derived from public events)
CREATE POLICY "Anyone can view event summaries"
ON public.event_summaries
FOR SELECT
USING (true);

-- Service role can insert/update
CREATE POLICY "Service role can manage summaries"
ON public.event_summaries
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);