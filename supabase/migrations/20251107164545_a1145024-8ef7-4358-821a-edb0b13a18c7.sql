-- Phase 3: Automated Data Quality Monitoring Tables

-- Quality metrics tracking
CREATE TABLE IF NOT EXISTS data_quality_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  score numeric CHECK (score >= 0 AND score <= 100),
  status text CHECK (status IN ('excellent', 'good', 'fair', 'poor', 'critical')),
  issues jsonb,
  recommendations jsonb,
  checked_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metrics_name ON data_quality_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_status ON data_quality_metrics(status);
CREATE INDEX IF NOT EXISTS idx_metrics_checked ON data_quality_metrics(checked_at);

-- Overall health results
CREATE TABLE IF NOT EXISTS health_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overall_score numeric,
  total_entities integer,
  healthy_entities integer,
  warning_entities integer,
  critical_entities integer,
  trending text CHECK (trending IN ('improving', 'stable', 'degrading')),
  priority_fixes jsonb,
  checked_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_checked ON health_check_results(checked_at);

-- Audit log for auto-fixes
CREATE TABLE IF NOT EXISTS data_quality_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  count integer,
  details jsonb,
  timestamp timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_log_action ON data_quality_log(action);
CREATE INDEX IF NOT EXISTS idx_log_timestamp ON data_quality_log(timestamp);

-- Dashboard query function
CREATE OR REPLACE FUNCTION get_health_dashboard()
RETURNS jsonb AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'current_score', (
      SELECT overall_score 
      FROM health_check_results 
      ORDER BY checked_at DESC 
      LIMIT 1
    ),
    'trending', (
      SELECT trending 
      FROM health_check_results 
      ORDER BY checked_at DESC 
      LIMIT 1
    ),
    'recent_checks', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'date', DATE(checked_at),
          'score', overall_score,
          'critical', critical_entities
        ) ORDER BY checked_at DESC
      )
      FROM (
        SELECT checked_at, overall_score, critical_entities
        FROM health_check_results
        ORDER BY checked_at DESC
        LIMIT 30
      ) recent
    ),
    'top_issues', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'metric', metric_name,
          'score', score,
          'status', status,
          'issue_count', jsonb_array_length(issues)
        )
      )
      FROM (
        SELECT DISTINCT ON (metric_name)
          metric_name, score, status, issues
        FROM data_quality_metrics
        WHERE status IN ('critical', 'poor')
        ORDER BY metric_name, checked_at DESC
      ) issues
    ),
    'recent_fixes', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'action', action,
          'count', count,
          'timestamp', timestamp
        ) ORDER BY timestamp DESC
      )
      FROM (
        SELECT action, count, timestamp
        FROM data_quality_log
        WHERE timestamp > now() - interval '7 days'
          AND action LIKE 'auto_%'
        ORDER BY timestamp DESC
        LIMIT 20
      ) fixes
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;