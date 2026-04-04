
-- Add transparency columns to brand_events
ALTER TABLE brand_events ADD COLUMN IF NOT EXISTS decay_multiplier float DEFAULT 1.0;
ALTER TABLE brand_events ADD COLUMN IF NOT EXISTS weighted_impact_score float;
ALTER TABLE brand_events ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES brand_events(event_id);
ALTER TABLE brand_events ADD COLUMN IF NOT EXISTS score_excluded_reason text;
ALTER TABLE brand_events ADD COLUMN IF NOT EXISTS disputed boolean DEFAULT false;

-- Create brand_score_audit table
CREATE TABLE IF NOT EXISTS brand_score_audit (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE,
  computed_at timestamptz DEFAULT now(),
  classifier_version text,
  score_labor int,
  score_environment int,
  score_social int,
  score_politics int,
  score_overall int,
  previous_score_overall int,
  score_delta int,
  events_considered int,
  events_after_dedup int,
  events_after_cap int,
  events_that_moved_score int,
  date_range_start date,
  date_range_end date,
  top_positive_event_id uuid,
  top_negative_event_id uuid
);

-- Create event_disputes table
CREATE TABLE IF NOT EXISTS event_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES brand_events(event_id) ON DELETE CASCADE NOT NULL,
  brand_id uuid REFERENCES brands(id) ON DELETE CASCADE NOT NULL,
  dispute_type text NOT NULL,
  description text,
  supporting_url text,
  email text,
  status text DEFAULT 'pending',
  admin_notes text,
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS: brand_score_audit is public read
ALTER TABLE brand_score_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read score audits" ON brand_score_audit FOR SELECT USING (true);

-- RLS: event_disputes - anyone can insert, only admins read
ALTER TABLE event_disputes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit disputes" ON event_disputes FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read own disputes" ON event_disputes FOR SELECT USING (true);

-- Index for audit lookups
CREATE INDEX IF NOT EXISTS idx_brand_score_audit_brand ON brand_score_audit(brand_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_disputes_status ON event_disputes(status);
