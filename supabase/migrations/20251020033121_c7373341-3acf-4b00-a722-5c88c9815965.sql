-- Helper function to increment rate limit counters atomically
CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_source text,
  p_window_start timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  INSERT INTO public.api_rate_limits (source, window_start, call_count, updated_at)
  VALUES (p_source, p_window_start, 1, now())
  ON CONFLICT (source, window_start)
  DO UPDATE SET
    call_count = api_rate_limits.call_count + 1,
    updated_at = now();
END;
$$;