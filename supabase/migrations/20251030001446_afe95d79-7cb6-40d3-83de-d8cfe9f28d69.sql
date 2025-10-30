-- Optional table for persisting daily brand digests
-- This allows tracking digest history and debugging

CREATE TABLE IF NOT EXISTS public.brand_daily_digest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  events_count INT NOT NULL DEFAULT 0,
  top_categories JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brand_daily_digest_brand_time_idx
  ON public.brand_daily_digest(brand_id, window_end DESC);

COMMENT ON TABLE public.brand_daily_digest IS 'Stores aggregated daily brand digest data for notification purposes';
COMMENT ON COLUMN public.brand_daily_digest.window_start IS 'Start of the 24h window';
COMMENT ON COLUMN public.brand_daily_digest.window_end IS 'End of the 24h window';
COMMENT ON COLUMN public.brand_daily_digest.events_count IS 'Number of events in this digest period';
COMMENT ON COLUMN public.brand_daily_digest.top_categories IS 'Top event categories in this digest';