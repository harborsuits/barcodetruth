-- Kill switch configuration table
CREATE TABLE IF NOT EXISTS public.app_config (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS (admin-only access)
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage app config"
  ON public.app_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Insert default push_enabled flag
INSERT INTO public.app_config (key, value)
VALUES ('push_enabled', 'true'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add per-brand pause flag to brands table
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS push_paused boolean NOT NULL DEFAULT false;

-- Dashboard view: hourly notification metrics
CREATE OR REPLACE VIEW v_notification_metrics_hourly AS
SELECT 
  date_trunc('hour', sent_at) AS hour,
  count(*) FILTER (WHERE success) AS sent_ok,
  count(*) FILTER (WHERE NOT success) AS sent_fail,
  count(DISTINCT brand_id) AS brands_notified,
  count(DISTINCT user_id) AS users_notified,
  avg(delta) FILTER (WHERE success AND delta IS NOT NULL) AS avg_delta
FROM notification_log
WHERE sent_at > now() - interval '48 hours'
GROUP BY 1
ORDER BY 1 DESC;

GRANT SELECT ON v_notification_metrics_hourly TO authenticated;

-- Dashboard view: rate limit pressure by brand
CREATE OR REPLACE VIEW v_rate_limit_pressure AS
SELECT 
  brand_id,
  count(DISTINCT user_id) AS users_following,
  sum(sent_today) AS total_sent_today,
  round(avg(sent_today)::numeric, 2) AS avg_per_user
FROM v_notification_usage_today
GROUP BY brand_id
ORDER BY total_sent_today DESC;

GRANT SELECT ON v_rate_limit_pressure TO authenticated;

-- Dashboard view: coalescing effectiveness
CREATE OR REPLACE VIEW v_coalescing_effectiveness AS
SELECT 
  date_trunc('hour', created_at) AS hour,
  count(*) FILTER (WHERE coalesce_key IS NULL) AS non_coalesced,
  count(*) FILTER (WHERE coalesce_key IS NOT NULL) AS coalesced,
  round(
    count(*) FILTER (WHERE coalesce_key IS NOT NULL)::numeric / 
    NULLIF(count(*)::numeric, 0) * 100, 
    2
  ) AS coalesced_pct
FROM jobs
WHERE stage = 'send_push_for_score_change'
  AND created_at > now() - interval '48 hours'
GROUP BY 1
ORDER BY 1 DESC;

GRANT SELECT ON v_coalescing_effectiveness TO authenticated;