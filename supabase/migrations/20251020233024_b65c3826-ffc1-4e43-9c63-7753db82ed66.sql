-- Enable RLS on tables missing it
ALTER TABLE _secrets_internal ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_error_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_api_usage ENABLE ROW LEVEL SECURITY;

-- _secrets_internal: Only service role can access
CREATE POLICY "Service role only access on _secrets_internal"
ON _secrets_internal
FOR ALL
USING (false);

-- api_error_log: Service role can insert, admins can read
CREATE POLICY "Service role can insert errors"
ON api_error_log
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can read error logs"
ON api_error_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- api_rate_config: Admins can manage, service role can read
CREATE POLICY "Service role can read rate config"
ON api_rate_config
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage rate config"
ON api_rate_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- brand_api_usage: Service role can manage, admins can read
CREATE POLICY "Service role can manage brand API usage"
ON brand_api_usage
FOR ALL
USING (true);

CREATE POLICY "Admins can read brand API usage"
ON brand_api_usage
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));