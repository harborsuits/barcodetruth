-- Config tables for tweakable scoring parameters
CREATE TABLE IF NOT EXISTS public.scoring_weights (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scoring_caps (
  key text PRIMARY KEY,
  value numeric NOT NULL,
  description text,
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scoring_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_caps ENABLE ROW LEVEL SECURITY;

-- Policies: public read, admin write
CREATE POLICY "Public read scoring_weights" ON public.scoring_weights FOR SELECT USING (true);
CREATE POLICY "Admins manage scoring_weights" ON public.scoring_weights FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read scoring_caps" ON public.scoring_caps FOR SELECT USING (true);
CREATE POLICY "Admins manage scoring_caps" ON public.scoring_caps FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed default weights
INSERT INTO public.scoring_weights (key, value, description) VALUES
  ('labor.osha.violation_pt', -6, 'Points per OSHA violation'),
  ('labor.osha.violation_cap', -40, 'Max penalty for violations'),
  ('labor.fines.log_base', 10000, 'Log base for fine scaling'),
  ('labor.fines.multiplier', -5, 'Points per 10x fine increase'),
  ('labor.fines.cap', -20, 'Max penalty for fines'),
  ('labor.sentiment.multiplier', 15, 'Points per rating point above/below 3'),
  ('labor.sentiment.cap_pos', 30, 'Max bonus for sentiment'),
  ('labor.sentiment.cap_neg', -30, 'Max penalty for sentiment'),
  ('labor.severe.multiplier', -15, 'Points per fatality'),
  ('labor.severe.cap', -30, 'Max penalty for severe incidents'),
  
  ('env.epa.action_pt', -7, 'Points per EPA action'),
  ('env.epa.cap', -35, 'Max penalty for EPA actions'),
  ('env.superfund.site_pt', -10, 'Points per Superfund site'),
  ('env.superfund.cap', -30, 'Max penalty for Superfund'),
  ('env.emissions.multiplier', -0.4, 'Points per percentile above 50'),
  ('env.emissions.cap_neg', -20, 'Max penalty for emissions'),
  ('env.emissions.cap_pos', 20, 'Max bonus for emissions'),
  ('env.cert.cert_pt', 5, 'Points per certification'),
  ('env.cert.cap', 15, 'Max bonus for certifications'),
  
  ('pol.tilt.multiplier', -0.5, 'Points per % tilt from 50/50'),
  ('pol.tilt.cap', -25, 'Max penalty for partisan tilt'),
  ('pol.donations.log_base', 100000, 'Log base for donation scaling'),
  ('pol.donations.multiplier', -3, 'Points per 10x donation increase'),
  ('pol.donations.cap', -15, 'Max penalty for donations'),
  ('pol.lobbying.log_base', 250000, 'Log base for lobbying scaling'),
  ('pol.lobbying.multiplier', -2.5, 'Points per 10x lobbying increase'),
  ('pol.lobbying.cap', -12.5, 'Max penalty for lobbying'),
  
  ('social.recall.class1_pt', -15, 'Points per Class I recall'),
  ('social.recall.class2_pt', -8, 'Points per Class II recall'),
  ('social.recall.class3_pt', -3, 'Points per Class III recall'),
  ('social.recall.cap', -30, 'Max penalty for recalls'),
  ('social.lawsuits.case_pt', -10, 'Points per lawsuit/action'),
  ('social.lawsuits.cap', -30, 'Max penalty for lawsuits'),
  ('social.sentiment.multiplier', 15, 'Points per sentiment unit'),
  ('social.sentiment.cap_pos', 15, 'Max bonus for sentiment'),
  ('social.sentiment.cap_neg', -15, 'Max penalty for sentiment'),
  
  ('window.delta.cap_pos', 15, 'Max positive window delta'),
  ('window.delta.cap_neg', -15, 'Max negative window delta'),
  
  ('confidence.coverage.weight', 0.40, 'Coverage weight in confidence calc'),
  ('confidence.recency.weight', 0.30, 'Recency weight in confidence calc'),
  ('confidence.corroboration.weight', 0.20, 'Corroboration weight in confidence calc'),
  ('confidence.stability.weight', 0.10, 'Stability weight in confidence calc')
ON CONFLICT (key) DO NOTHING;

-- Seed default caps
INSERT INTO public.scoring_caps (key, value, description) VALUES
  ('labor.min', 0, 'Min labor score'),
  ('labor.max', 100, 'Max labor score'),
  ('labor.start', 70, 'Starting labor score'),
  ('environment.min', 0, 'Min environment score'),
  ('environment.max', 100, 'Max environment score'),
  ('environment.start', 70, 'Starting environment score'),
  ('politics.min', 0, 'Min politics score'),
  ('politics.max', 100, 'Max politics score'),
  ('politics.start', 70, 'Starting politics score'),
  ('social.min', 0, 'Min social score'),
  ('social.max', 100, 'Max social score'),
  ('social.start', 70, 'Starting social score')
ON CONFLICT (key) DO NOTHING;

-- Aggregation view for 24-month baseline inputs per brand
CREATE OR REPLACE VIEW public.v_baseline_inputs_24m AS
SELECT 
  b.id as brand_id,
  b.name as brand_name,
  
  -- Labor inputs
  COUNT(DISTINCT CASE WHEN be.category = 'labor' THEN be.event_id END) as labor_violations_24m,
  COALESCE(SUM(CASE WHEN be.category = 'labor' AND be.raw_data ? 'penalty_amount' 
    THEN (be.raw_data->>'penalty_amount')::numeric ELSE 0 END), 0) as labor_fines_24m,
  0 as labor_sentiment_24m, -- TODO: integrate worker reviews
  COUNT(DISTINCT CASE WHEN be.category = 'labor' AND be.severity = 'catastrophic' THEN be.event_id END) as labor_fatalities_24m,
  
  -- Environment inputs
  COUNT(DISTINCT CASE WHEN be.category = 'environment' THEN be.event_id END) as env_actions_24m,
  0 as env_superfund_active, -- TODO: track Superfund involvement
  0 as env_emissions_percentile, -- TODO: calculate TRI percentile
  0 as env_certifications, -- TODO: track certifications
  
  -- Politics inputs (from FEC events)
  COALESCE(SUM(CASE WHEN be.category = 'politics' AND be.raw_data ? 'amount' 
    THEN (be.raw_data->>'amount')::numeric ELSE 0 END), 0) as pol_donations_24m,
  COALESCE(SUM(CASE WHEN be.category = 'politics' AND be.raw_data ? 'recipient_party' AND be.raw_data->>'recipient_party' ILIKE '%dem%'
    THEN (be.raw_data->>'amount')::numeric ELSE 0 END), 0) as pol_dem_donations_24m,
  COALESCE(SUM(CASE WHEN be.category = 'politics' AND be.raw_data ? 'recipient_party' AND be.raw_data->>'recipient_party' ILIKE '%rep%'
    THEN (be.raw_data->>'amount')::numeric ELSE 0 END), 0) as pol_rep_donations_24m,
  0 as pol_lobbying_24m, -- TODO: integrate lobbying data
  
  -- Social inputs
  COUNT(DISTINCT CASE WHEN be.category = 'social' AND be.raw_data->>'recall_class' = 'I' THEN be.event_id END) as social_recalls_class1_24m,
  COUNT(DISTINCT CASE WHEN be.category = 'social' AND be.raw_data->>'recall_class' = 'II' THEN be.event_id END) as social_recalls_class2_24m,
  COUNT(DISTINCT CASE WHEN be.category = 'social' AND be.raw_data->>'recall_class' = 'III' THEN be.event_id END) as social_recalls_class3_24m,
  COUNT(DISTINCT CASE WHEN be.category = 'social' AND be.raw_data ? 'lawsuit' THEN be.event_id END) as social_lawsuits_24m,
  
  -- Social sentiment (from GDELT baseline or news)
  COALESCE((SELECT median_tone FROM brand_social_baseline WHERE brand_id = b.id ORDER BY fetched_at DESC LIMIT 1), 0) as social_sentiment_avg,
  
  -- Confidence inputs
  COUNT(DISTINCT be.event_id) as total_events_24m,
  COUNT(DISTINCT es.registrable_domain) as distinct_sources_24m,
  COUNT(DISTINCT CASE WHEN be.created_at >= now() - interval '12 months' THEN be.event_id END) as events_last_12m,
  
  now() as calculated_at
FROM public.brands b
LEFT JOIN public.brand_events be ON be.brand_id = b.id 
  AND be.occurred_at >= now() - interval '24 months'
LEFT JOIN public.event_sources es ON es.event_id = be.event_id
GROUP BY b.id, b.name;

-- Aggregation view for 90-day recent window per brand
CREATE OR REPLACE VIEW public.v_baseline_inputs_90d AS
SELECT 
  b.id as brand_id,
  b.name as brand_name,
  
  -- Labor inputs (90d)
  COUNT(DISTINCT CASE WHEN be.category = 'labor' THEN be.event_id END) as labor_violations_90d,
  COALESCE(SUM(CASE WHEN be.category = 'labor' AND be.raw_data ? 'penalty_amount' 
    THEN (be.raw_data->>'penalty_amount')::numeric ELSE 0 END), 0) as labor_fines_90d,
  0 as labor_sentiment_90d,
  COUNT(DISTINCT CASE WHEN be.category = 'labor' AND be.severity = 'catastrophic' THEN be.event_id END) as labor_fatalities_90d,
  
  -- Environment inputs (90d)
  COUNT(DISTINCT CASE WHEN be.category = 'environment' THEN be.event_id END) as env_actions_90d,
  
  -- Politics inputs (90d)
  COALESCE(SUM(CASE WHEN be.category = 'politics' AND be.raw_data ? 'amount' 
    THEN (be.raw_data->>'amount')::numeric ELSE 0 END), 0) as pol_donations_90d,
  COALESCE(SUM(CASE WHEN be.category = 'politics' AND be.raw_data ? 'recipient_party' AND be.raw_data->>'recipient_party' ILIKE '%dem%'
    THEN (be.raw_data->>'amount')::numeric ELSE 0 END), 0) as pol_dem_donations_90d,
  COALESCE(SUM(CASE WHEN be.category = 'politics' AND be.raw_data ? 'recipient_party' AND be.raw_data->>'recipient_party' ILIKE '%rep%'
    THEN (be.raw_data->>'amount')::numeric ELSE 0 END), 0) as pol_rep_donations_90d,
  
  -- Social inputs (90d)
  COUNT(DISTINCT CASE WHEN be.category = 'social' AND be.raw_data->>'recall_class' = 'I' THEN be.event_id END) as social_recalls_class1_90d,
  COUNT(DISTINCT CASE WHEN be.category = 'social' AND be.raw_data->>'recall_class' = 'II' THEN be.event_id END) as social_recalls_class2_90d,
  COUNT(DISTINCT CASE WHEN be.category = 'social' AND be.raw_data->>'recall_class' = 'III' THEN be.event_id END) as social_recalls_class3_90d,
  COUNT(DISTINCT CASE WHEN be.category = 'social' AND be.raw_data ? 'lawsuit' THEN be.event_id END) as social_lawsuits_90d,
  
  COUNT(DISTINCT be.event_id) as total_events_90d,
  now() as calculated_at
FROM public.brands b
LEFT JOIN public.brand_events be ON be.brand_id = b.id 
  AND be.occurred_at >= now() - interval '90 days'
GROUP BY b.id, b.name;