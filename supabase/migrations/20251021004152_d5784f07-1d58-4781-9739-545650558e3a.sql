
-- Create classification audit table for telemetry
CREATE TABLE IF NOT EXISTS classification_audit (
  event_id uuid PRIMARY KEY REFERENCES brand_events(event_id) ON DELETE CASCADE,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  primary_code text NOT NULL,
  secondary_codes text[],
  confidence numeric NOT NULL,
  source_domain text,
  keyword_scores jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_classification_audit_primary_code ON classification_audit(primary_code);
CREATE INDEX IF NOT EXISTS idx_classification_audit_created_at ON classification_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classification_audit_brand_id ON classification_audit(brand_id);

-- RLS policies
ALTER TABLE classification_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view classification audit"
  ON classification_audit FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage classification audit"
  ON classification_audit FOR ALL
  USING (true)
  WITH CHECK (true);
