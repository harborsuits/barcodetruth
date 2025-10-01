-- Fix views to use SECURITY INVOKER
DROP VIEW IF EXISTS v_notification_metrics_hourly;
DROP VIEW IF EXISTS v_rate_limit_pressure;
DROP VIEW IF EXISTS v_coalescing_effectiveness;

-- Recreate views with SECURITY INVOKER
CREATE VIEW v_notification_metrics_hourly 
WITH (security_invoker = true) AS
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

CREATE VIEW v_rate_limit_pressure 
WITH (security_invoker = true) AS
SELECT 
  brand_id,
  count(DISTINCT user_id) AS users_following,
  sum(sent_today) AS total_sent_today,
  round(avg(sent_today)::numeric, 2) AS avg_per_user
FROM v_notification_usage_today
GROUP BY brand_id
ORDER BY total_sent_today DESC;

CREATE VIEW v_coalescing_effectiveness 
WITH (security_invoker = true) AS
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