CREATE INDEX IF NOT EXISTS idx_brand_events_event_date ON public.brand_events (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_id ON public.brand_events (brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_date ON public.brand_events (brand_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_event_sources_event_id ON public.event_sources (event_id);