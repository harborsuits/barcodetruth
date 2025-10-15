-- Block client access to baseline tables (real + cited only enforcement)
REVOKE SELECT ON TABLE brand_scores FROM anon, authenticated;
REVOKE SELECT ON TABLE brand_scores_history FROM anon, authenticated;

-- Drop any existing permissive policies
DROP POLICY IF EXISTS allow_read_brand_scores ON brand_scores;
DROP POLICY IF EXISTS allow_read_brand_scores_history ON brand_scores_history;

-- Add explicit DENY policy to prevent any workarounds
CREATE POLICY block_baseline_access ON brand_scores
  FOR SELECT
  USING (false);

CREATE POLICY block_baseline_history_access ON brand_scores_history
  FOR SELECT
  USING (false);