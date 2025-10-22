-- Create RPC function to get enrichment stats
CREATE OR REPLACE FUNCTION get_enrichment_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total_runs_24h', (
      SELECT COUNT(*)
      FROM enrichment_runs
      WHERE run_at > NOW() - INTERVAL '24 hours'
    ),
    'parents_found_24h', (
      SELECT COUNT(*)
      FROM enrichment_runs
      WHERE run_at > NOW() - INTERVAL '24 hours'
        AND parent_found = true
    ),
    'people_added_24h', (
      SELECT COALESCE(SUM(people_added), 0)
      FROM enrichment_runs
      WHERE run_at > NOW() - INTERVAL '24 hours'
    ),
    'tickers_added_24h', (
      SELECT COUNT(*)
      FROM enrichment_runs
      WHERE run_at > NOW() - INTERVAL '24 hours'
        AND ticker_added = true
    ),
    'avg_duration_ms', (
      SELECT COALESCE(AVG(duration_ms), 0)
      FROM enrichment_runs
      WHERE run_at > NOW() - INTERVAL '24 hours'
        AND duration_ms IS NOT NULL
    ),
    'error_rate', (
      SELECT CASE 
        WHEN COUNT(*) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE error_message IS NOT NULL)::numeric / COUNT(*)::numeric) * 100, 2)
        ELSE 0
      END
      FROM enrichment_runs
      WHERE run_at > NOW() - INTERVAL '24 hours'
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;