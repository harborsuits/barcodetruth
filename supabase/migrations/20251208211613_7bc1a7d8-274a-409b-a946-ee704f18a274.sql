
-- Enable RLS on internal/operational tables
ALTER TABLE brand_daily_digest ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_quality_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_check_results ENABLE ROW LEVEL SECURITY;

-- Allow public read access to brand_daily_digest (non-sensitive aggregated data)
CREATE POLICY "Public read brand_daily_digest" 
ON brand_daily_digest FOR SELECT 
USING (true);

-- Service role can manage brand_daily_digest
CREATE POLICY "Service role manage brand_daily_digest"
ON brand_daily_digest FOR ALL
USING (true)
WITH CHECK (true);

-- Only admins and service role can access data quality tables
CREATE POLICY "Admins can read data_quality_log"
ON data_quality_log FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manage data_quality_log"
ON data_quality_log FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can read data_quality_metrics"
ON data_quality_metrics FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manage data_quality_metrics"
ON data_quality_metrics FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins can read health_check_results"
ON health_check_results FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manage health_check_results"
ON health_check_results FOR ALL
USING (true)
WITH CHECK (true);
