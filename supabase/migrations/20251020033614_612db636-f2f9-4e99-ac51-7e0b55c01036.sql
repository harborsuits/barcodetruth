-- Per-source budget config
CREATE TABLE IF NOT EXISTS public.api_rate_config (
  source TEXT PRIMARY KEY,
  window_kind TEXT NOT NULL CHECK (window_kind IN ('hour','day','month')),
  limit_per_window INT NOT NULL CHECK (limit_per_window > 0)
);

-- Seed sane defaults
INSERT INTO public.api_rate_config (source, window_kind, limit_per_window) VALUES
  ('guardian',  'day',  500),
  ('gdelt',     'day',  5000),
  ('newsapi',   'day',  100),
  ('gnews',     'day',  100),
  ('nyt',       'day',  500),
  ('mediastack','day',  16),   -- ~500/month ÷ 30
  ('currents',  'day',  20)    -- ~600/month ÷ 30
ON CONFLICT (source) DO NOTHING;

-- Make usage table enforce uniqueness per window
CREATE UNIQUE INDEX IF NOT EXISTS api_rate_limits_uniq
  ON public.api_rate_limits (source, window_start);

-- Helper to get current window start based on window kind
CREATE OR REPLACE FUNCTION public.current_window_start(p_kind TEXT)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT CASE p_kind
    WHEN 'hour'  THEN date_trunc('hour',  now())
    WHEN 'day'   THEN date_trunc('day',   now())
    WHEN 'month' THEN date_trunc('month', now())
    ELSE date_trunc('day', now())
  END;
$$;

-- Atomically check budget and increment if allowed
CREATE OR REPLACE FUNCTION public.try_spend(p_source TEXT, p_cost INT DEFAULT 1)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_kind TEXT;
  v_limit INT;
  v_win   timestamptz;
  v_count INT;
BEGIN
  SELECT window_kind, limit_per_window
    INTO v_kind, v_limit
  FROM api_rate_config
  WHERE source = p_source;

  IF v_kind IS NULL THEN
    -- No config → treat as unlimited (fail open)
    RETURN true;
  END IF;

  v_win := current_window_start(v_kind);

  -- Upsert row for the window if missing
  INSERT INTO api_rate_limits (source, window_start, call_count, updated_at)
  VALUES (p_source, v_win, 0, now())
  ON CONFLICT (source, window_start) DO NOTHING;

  -- Lock the row, check, then increment if allowed
  SELECT call_count INTO v_count
  FROM api_rate_limits
  WHERE source = p_source AND window_start = v_win
  FOR UPDATE;

  IF v_count + p_cost > v_limit THEN
    RETURN false;
  END IF;

  UPDATE api_rate_limits
  SET call_count = v_count + p_cost, updated_at = now()
  WHERE source = p_source AND window_start = v_win;

  RETURN true;
END;
$$;

-- Optional: error log for visibility
CREATE TABLE IF NOT EXISTS public.api_error_log (
  id bigserial PRIMARY KEY,
  source TEXT NOT NULL,
  status INT,
  message TEXT,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS api_error_log_source_occurred 
  ON public.api_error_log (source, occurred_at DESC);