-- Drop the view to recreate it without SECURITY DEFINER
DROP VIEW IF EXISTS v_notification_usage_today;

-- Create view with SECURITY INVOKER (default) - relies on RLS
CREATE VIEW v_notification_usage_today 
WITH (security_invoker = true) AS
SELECT
  user_id,
  brand_id,
  count(*)::int AS sent_today
FROM notification_log
WHERE success = true
  AND sent_day = CURRENT_DATE
GROUP BY user_id, brand_id;