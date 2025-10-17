-- Create api_rate_limits table for tracking news source usage
CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  source TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source, window_start)
);

-- Enable RLS
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

-- Admins can manage rate limits
CREATE POLICY "Admins can manage rate limits"
  ON public.api_rate_limits
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can manage rate limits
CREATE POLICY "Service role can manage rate limits"
  ON public.api_rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window 
  ON public.api_rate_limits(source, window_start DESC);