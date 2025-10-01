-- Create view for fast notification usage lookup
CREATE OR REPLACE VIEW v_notification_usage_today AS
SELECT
  user_id,
  brand_id,
  count(*)::int AS sent_today
FROM notification_log
WHERE success = true
  AND sent_day = CURRENT_DATE
GROUP BY user_id, brand_id;

-- Grant access to authenticated users
GRANT SELECT ON v_notification_usage_today TO authenticated;