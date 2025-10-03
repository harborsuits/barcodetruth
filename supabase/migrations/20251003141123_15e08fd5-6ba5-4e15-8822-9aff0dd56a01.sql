-- Final polish: security, constraints, performance, monitoring

-- 1) Make views security-invoker to respect caller's RLS
ALTER VIEW public.v_brand_sources_inline SET (security_invoker = true);
ALTER VIEW public.v_parent_rollups SET (security_invoker = true);
ALTER VIEW public.v_baseline_inputs_24m SET (security_invoker = true);
ALTER VIEW public.v_baseline_inputs_90d SET (security_invoker = true);

-- 2) Add CHECK constraint on orientation (defensive)
ALTER TABLE public.brand_events
ADD CONSTRAINT chk_orientation
CHECK (orientation::text IN ('positive','negative','neutral'));

-- 3) Make trigger idempotent (no flapping on harmless updates)
CREATE OR REPLACE FUNCTION public.tg_set_event_orientation()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cat text := NEW.category::text;
  sev text := COALESCE(NEW.severity::text,'');
  amt numeric := NULLIF((NEW.raw_data->>'penalty_amount')::numeric, NULL);
  recall_class text := COALESCE(NEW.raw_data->>'recall_class','');
BEGIN
  -- Short-circuit if orientation unchanged on update
  IF TG_OP='UPDATE' AND NEW.orientation = OLD.orientation THEN
    RETURN NEW;
  END IF;

  -- Positive signals (awards/certifications/emissions drop, etc.)
  IF cat='environment' AND (NEW.raw_data ? 'certification' OR (NEW.raw_data->>'emissions_change')::numeric < 0) THEN
    NEW.orientation := 'positive';
  ELSIF cat='politics' AND (NEW.raw_data->>'donation_party') ILIKE '%nonpartisan%' THEN
    NEW.orientation := 'neutral';

  -- Typical negatives
  ELSIF cat='labor' AND (amt IS NOT NULL OR sev IN ('moderate','severe','catastrophic')) THEN
    NEW.orientation := 'negative';
  ELSIF cat='environment' AND (sev <> '' OR NEW.raw_data ? 'violation') THEN
    NEW.orientation := 'negative';
  ELSIF cat='social' AND recall_class IN ('I','II','III') THEN
    NEW.orientation := 'negative';
  ELSE
    NEW.orientation := COALESCE(NEW.orientation,'neutral');
  END IF;

  RETURN NEW;
END$$;

-- 4) Backfill null orientations for existing events
UPDATE public.brand_events SET updated_at = updated_at WHERE orientation IS NULL;

-- 5) Add covering index for InlineSources pagination (Postgres 14+)
CREATE INDEX IF NOT EXISTS idx_sources_inline_cov
ON public.brand_events (brand_id, category, occurred_at DESC)
INCLUDE (severity, verification, raw_data);

-- 6) Create scoring_switches table for runtime feature flags
CREATE TABLE IF NOT EXISTS public.scoring_switches (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scoring_switches ENABLE ROW LEVEL SECURITY;

-- Public read, admin write
CREATE POLICY scoring_switches_read ON public.scoring_switches
  FOR SELECT USING (true);

CREATE POLICY scoring_switches_write ON public.scoring_switches
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Seed with common switches
INSERT INTO public.scoring_switches (key, enabled, description) VALUES
  ('politics_alignment_penalty', false, 'Apply user political alignment penalties to politics scores'),
  ('news_tone_enabled', false, 'Include news sentiment tone in social scoring'),
  ('parent_rollup_enabled', true, 'Include parent company scores in brand calculations')
ON CONFLICT (key) DO NOTHING;