
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS last_news_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_material_event_at timestamptz,
  ADD COLUMN IF NOT EXISTS news_coverage_status text DEFAULT 'never_checked',
  ADD COLUMN IF NOT EXISTS material_event_count_30d integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coverage_priority integer DEFAULT 3
