-- 1) Drop and recreate v_baseline_inputs_90d with mixed event counts
DROP VIEW IF EXISTS public.v_baseline_inputs_90d CASCADE;

CREATE VIEW public.v_baseline_inputs_90d AS
SELECT 
  b.id AS brand_id,
  b.name AS brand_name,
  -- Labor (90d)
  COUNT(DISTINCT CASE WHEN be.category='labor' THEN be.event_id END) AS labor_violations_90d,
  COALESCE(SUM(CASE WHEN be.category='labor' AND be.raw_data ? 'penalty_amount'
    THEN (be.raw_data->>'penalty_amount')::numeric ELSE 0 END), 0) AS labor_fines_90d,
  0 AS labor_sentiment_90d,
  COUNT(DISTINCT CASE WHEN be.category='labor' AND be.severity='catastrophic' THEN be.event_id END) AS labor_fatalities_90d,
  COUNT(DISTINCT CASE WHEN be.category='labor' AND be.orientation='mixed' THEN be.event_id END) AS labor_mixed_90d,
  -- Environment (90d)
  COUNT(DISTINCT CASE WHEN be.category='environment' THEN be.event_id END) AS env_actions_90d,
  COUNT(DISTINCT CASE WHEN be.category='environment' AND be.orientation='mixed' THEN be.event_id END) AS env_mixed_90d,
  -- Politics (90d)
  COALESCE(SUM(CASE WHEN be.category='politics' AND be.raw_data ? 'amount'
    THEN (be.raw_data->>'amount')::numeric ELSE 0 END), 0) AS pol_donations_90d,
  COALESCE(SUM(CASE WHEN be.category='politics' AND be.raw_data ? 'recipient_party' AND be.raw_data->>'recipient_party' ILIKE '%dem%'
    THEN (be.raw_data->>'amount')::numeric ELSE 0 END), 0) AS pol_dem_donations_90d,
  COALESCE(SUM(CASE WHEN be.category='politics' AND be.raw_data ? 'recipient_party' AND be.raw_data->>'recipient_party' ILIKE '%rep%'
    THEN (be.raw_data->>'amount')::numeric ELSE 0 END), 0) AS pol_rep_donations_90d,
  COUNT(DISTINCT CASE WHEN be.category='politics' AND be.orientation='mixed' THEN be.event_id END) AS pol_mixed_90d,
  -- Social (90d)
  COUNT(DISTINCT CASE WHEN be.category='social' AND be.raw_data->>'recall_class'='I' THEN be.event_id END) AS social_recalls_class1_90d,
  COUNT(DISTINCT CASE WHEN be.category='social' AND be.raw_data->>'recall_class'='II' THEN be.event_id END) AS social_recalls_class2_90d,
  COUNT(DISTINCT CASE WHEN be.category='social' AND be.raw_data->>'recall_class'='III' THEN be.event_id END) AS social_recalls_class3_90d,
  COUNT(DISTINCT CASE WHEN be.category='social' AND be.raw_data ? 'lawsuit' THEN be.event_id END) AS social_lawsuits_90d,
  COUNT(DISTINCT CASE WHEN be.category='social' AND be.orientation='mixed' THEN be.event_id END) AS social_mixed_90d,
  COUNT(DISTINCT be.event_id) AS total_events_90d,
  NOW() AS calculated_at
FROM public.brands b
LEFT JOIN public.brand_events be 
  ON be.brand_id=b.id AND be.occurred_at >= NOW() - INTERVAL '90 days'
GROUP BY b.id, b.name;

-- 2) Add index for efficient keyset pagination
CREATE INDEX IF NOT EXISTS idx_brand_events_brand_category_date_id
ON public.brand_events(brand_id, category, occurred_at DESC, event_id DESC);

-- 3) Create brand_feature_flags table for per-brand opt-ins
CREATE TABLE IF NOT EXISTS public.brand_feature_flags (
  brand_id uuid REFERENCES public.brands(id) ON DELETE CASCADE,
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  PRIMARY KEY (brand_id, key)
);

ALTER TABLE public.brand_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY bff_read ON public.brand_feature_flags 
  FOR SELECT USING (true);

CREATE POLICY bff_write ON public.brand_feature_flags 
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 4) Seed mixed event weights (small negative contribution, capped)
INSERT INTO public.scoring_weights(key, value, description) VALUES
  ('window.mixed.pt', -0.5, 'Points per mixed-orientation event in 90d window'),
  ('window.mixed.cap', -3, 'Maximum total penalty from mixed events in 90d window')
ON CONFLICT (key) DO UPDATE SET 
  value = EXCLUDED.value,
  description = EXCLUDED.description;

-- 5) Seed feature flags (conservative defaults)
INSERT INTO public.scoring_switches(key, enabled, description) VALUES
  ('politics_alignment_penalty', true, 'Apply 0.25x multiplier to partisan tilt penalty'),
  ('news_tone_enabled', false, 'Enable GDELT news tone in social scoring (requires per-brand opt-in)')
ON CONFLICT (key) DO UPDATE SET 
  enabled = EXCLUDED.enabled,
  description = EXCLUDED.description;