-- Add composite index for efficient cursor pagination on brand_events
-- This supports the v_brand_sources_inline view with proper ordering
CREATE INDEX IF NOT EXISTS idx_brand_events_occurred_id
  ON public.brand_events (brand_id, occurred_at DESC, event_id DESC);