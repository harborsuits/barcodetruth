
-- Create event_rules table for categorization logic
CREATE TABLE IF NOT EXISTS public.event_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_code TEXT NOT NULL,
  match_type TEXT NOT NULL CHECK (match_type IN ('domain', 'path', 'title', 'body')),
  pattern TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50,
  enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_event_rules_enabled ON public.event_rules(enabled, priority DESC) WHERE enabled = true;
CREATE INDEX idx_event_rules_category ON public.event_rules(category_code);

-- RLS policies
ALTER TABLE public.event_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read event_rules"
  ON public.event_rules FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage event_rules"
  ON public.event_rules FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Function to test article categorization
CREATE OR REPLACE FUNCTION public.test_article_categorization(
  p_domain TEXT,
  p_path TEXT,
  p_title TEXT,
  p_body TEXT
)
RETURNS TABLE(
  category_code TEXT,
  matched_rule_id UUID,
  match_type TEXT,
  pattern TEXT,
  priority INTEGER,
  rule_notes TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    er.category_code,
    er.id,
    er.match_type,
    er.pattern,
    er.priority,
    er.notes
  FROM event_rules er
  WHERE er.enabled = true
    AND (
      (er.match_type = 'domain' AND COALESCE(p_domain, '') ~ er.pattern)
      OR (er.match_type = 'path' AND COALESCE(p_path, '') ~ er.pattern)
      OR (er.match_type = 'title' AND COALESCE(p_title, '') ~* er.pattern)
      OR (er.match_type = 'body' AND COALESCE(p_body, '') ~* er.pattern)
    )
  ORDER BY er.priority DESC, er.created_at ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.test_article_categorization(TEXT, TEXT, TEXT, TEXT) TO authenticated, anon;

-- Seed initial high-priority rules for critical categories
INSERT INTO public.event_rules (category_code, match_type, pattern, priority, enabled, notes) VALUES
  -- PRODUCT RECALLS (highest priority - safety critical)
  ('product_safety', 'domain', 'fda\.gov', 100, true, 'FDA official recalls'),
  ('product_safety', 'domain', 'cpsc\.gov', 100, true, 'CPSC product safety recalls'),
  ('product_safety', 'path', '/recalls?/', 95, true, 'URL contains /recall/'),
  ('product_safety', 'title', '(?i)\brecall(s|ed|ing)?\b', 90, true, 'Title mentions recall'),
  
  -- LEGAL (litigation, lawsuits)
  ('legal', 'title', '(?i)(lawsuit|sued|litigation|settlement|class.?action|court|jury|verdict)', 85, true, 'Legal action keywords'),
  ('legal', 'title', '(?i)(trial|plaintiff|defendant|damages|judgment)', 85, true, 'Court proceedings'),
  ('legal', 'domain', 'sec\.gov', 95, true, 'SEC filings'),
  
  -- LABOR (workplace, employment)
  ('labor', 'domain', 'osha\.gov', 95, true, 'OSHA workplace safety'),
  ('labor', 'title', '(?i)(layoff|firing|union|strike|workplace|employment|hiring)', 80, true, 'Labor/employment'),
  ('labor', 'title', '(?i)(worker|employee|staff).*(injury|death|accident)', 85, true, 'Workplace incidents'),
  
  -- ENVIRONMENT
  ('environment', 'domain', 'epa\.gov', 95, true, 'EPA environmental'),
  ('environment', 'title', '(?i)(pollution|environmental|toxic|contamination|emissions|climate.?violation)', 80, true, 'Environmental issues'),
  
  -- POLITICS/LOBBYING
  ('politics', 'domain', 'fec\.gov', 95, true, 'FEC political contributions'),
  ('politics', 'title', '(?i)(lobby|lobbying|political.?(contribution|donation|pac))', 75, true, 'Political activity'),
  
  -- SOCIAL (DEI, community)
  ('social', 'title', '(?i)(diversity|inclusion|dei|discrimination|harassment)', 75, true, 'DEI and discrimination'),
  ('social', 'title', '(?i)(community|charity|donation|philanthropy)', 70, true, 'Community engagement')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.event_rules IS 'Rules for automatically categorizing brand events based on domain, path, title, and body content';
COMMENT ON FUNCTION public.test_article_categorization IS 'Test what category an article would be assigned based on current rules';
