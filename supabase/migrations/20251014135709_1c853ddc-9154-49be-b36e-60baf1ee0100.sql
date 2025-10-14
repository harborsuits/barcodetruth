-- Add canonical columns to brand_scores for UI/RPC contract
ALTER TABLE brand_scores
  ADD COLUMN IF NOT EXISTS score integer,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reason_json jsonb;

-- Create score_runs logging table
CREATE TABLE IF NOT EXISTS score_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  events_count int NOT NULL DEFAULT 0,
  brands_updated int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  details jsonb
);

-- RLS for score_runs (admins only)
ALTER TABLE score_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view score runs"
  ON score_runs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage score runs"
  ON score_runs FOR ALL
  USING (true)
  WITH CHECK (true);