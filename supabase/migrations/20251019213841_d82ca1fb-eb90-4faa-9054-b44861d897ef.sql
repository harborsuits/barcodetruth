-- Seed comprehensive event categorization rules
-- FINANCIAL CATEGORIES (high priority for stock/trading news)
INSERT INTO event_rules (category_code, match_type, pattern, priority, enabled, notes) VALUES
  -- Institutional trading (highest priority for specific patterns)
  ('FIN.INSTITUTIONAL', 'title', '(?i)(sells?|buys?|purchases?|acquires?|disposes?).*\d+.*shares?', 95, true, 'Institutional buying/selling of shares'),
  ('FIN.INSTITUTIONAL', 'title', '(?i)(investment|wealth|capital|fund|institutional).*(stake|position|holdings?)', 95, true, 'Institutional holdings and positions'),
  
  -- Stock positions/holdings
  ('FIN.HOLDINGS', 'title', '(?i)(stock|holdings?|position|stake).*in', 90, true, 'Stock holdings and positions'),
  ('FIN.HOLDINGS', 'title', '(?i)(increases?|decreases?|lowers?|raises?).*stake', 90, true, 'Changes in stake positions'),
  
  -- Earnings/financial results
  ('FIN.EARNINGS', 'title', '(?i)(earnings|revenue|profit|loss|quarterly|annual).*(report|results?)', 95, true, 'Financial results and earnings'),
  ('FIN.EARNINGS', 'domain', 'sec\.gov', 100, true, 'SEC filings'),
  
  -- Mergers & Acquisitions
  ('FIN.MERGER', 'title', '(?i)(merger|acquisition|acquired|buys|takeover|deal)', 90, true, 'M&A activity'),
  
  -- General financial news (lower priority - catch-all)
  ('FIN.GENERAL', 'title', '(?i)(stock|shares?|trading|market|financial|investor)', 70, true, 'General financial news');

-- PRODUCT RECALLS (safety critical - highest priority)
INSERT INTO event_rules (category_code, match_type, pattern, priority, enabled, notes) VALUES
  ('PRODUCT.RECALL', 'domain', 'fda\.gov', 100, true, 'FDA domain'),
  ('PRODUCT.RECALL', 'domain', 'cpsc\.gov', 100, true, 'CPSC domain'),
  ('PRODUCT.RECALL', 'domain', 'nhtsa\.gov', 100, true, 'NHTSA vehicle recalls'),
  ('PRODUCT.RECALL', 'path', '/recalls?/', 95, true, 'Recall path'),
  ('PRODUCT.RECALL', 'title', '(?i)\brecall(s|ed|ing)?\b', 90, true, 'Recall keyword in title');

-- REGULATORY
INSERT INTO event_rules (category_code, match_type, pattern, priority, enabled, notes) VALUES
  ('REGULATORY.EPA', 'domain', 'epa\.gov', 95, true, 'EPA domain'),
  ('REGULATORY.SEC', 'domain', 'sec\.gov', 95, true, 'SEC domain'),
  ('REGULATORY.FTC', 'domain', 'ftc\.gov', 95, true, 'FTC domain'),
  ('REGULATORY.OSHA', 'domain', 'osha\.gov', 95, true, 'OSHA domain'),
  ('REGULATORY.GENERAL', 'title', '(?i)(fine|penalty|violation|cited|warning letter)', 85, true, 'Regulatory actions');

-- LEGAL
INSERT INTO event_rules (category_code, match_type, pattern, priority, enabled, notes) VALUES
  ('LEGAL.LITIGATION', 'title', '(?i)(lawsuit|sued|litigation|settlement|class.?action)', 90, true, 'Litigation and lawsuits'),
  ('LEGAL.INVESTIGATION', 'title', '(?i)(investigation|probe|inquiry|subpoena)', 85, true, 'Legal investigations');

-- LABOR
INSERT INTO event_rules (category_code, match_type, pattern, priority, enabled, notes) VALUES
  ('LABOR.WORKFORCE', 'title', '(?i)(layoff|hiring|employment|union|strike)', 80, true, 'Workforce and employment'),
  ('LABOR.SAFETY', 'domain', 'osha\.gov', 90, true, 'OSHA workplace safety'),
  ('LABOR.SAFETY', 'title', '(?i)(workplace.?(injury|accident|death|safety))', 85, true, 'Workplace safety incidents');

-- ESG
INSERT INTO event_rules (category_code, match_type, pattern, priority, enabled, notes) VALUES
  ('ESG.CLIMATE', 'title', '(?i)(climate|carbon|emissions?|net.?zero|renewable|sustainability)', 85, true, 'Climate and sustainability'),
  ('ESG.SOCIAL', 'title', '(?i)(diversity|inclusion|dei|discrimination|equity)', 85, true, 'Social and DEI'),
  ('ESG.GOVERNANCE', 'title', '(?i)(ethics|corruption|bribery|transparency|governance)', 85, true, 'Governance and ethics');

-- POLICY (political contributions)
INSERT INTO event_rules (category_code, match_type, pattern, priority, enabled, notes) VALUES
  ('POLICY.FEC', 'domain', 'fec\.gov', 90, true, 'FEC domain'),
  ('POLICY.LOBBYING', 'title', '(?i)(lobby|lobbying|political.?(contribution|donation))', 80, true, 'Lobbying and political contributions');

-- Create function to reclassify existing events
CREATE OR REPLACE FUNCTION reclassify_all_events()
RETURNS TABLE(
  updated_count INTEGER,
  financial_count INTEGER,
  recall_count INTEGER,
  legal_count INTEGER,
  regulatory_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_count INTEGER := 0;
  v_financial_count INTEGER := 0;
  v_recall_count INTEGER := 0;
  v_legal_count INTEGER := 0;
  v_regulatory_count INTEGER := 0;
  v_event RECORD;
  v_result RECORD;
BEGIN
  -- Loop through all events that need reclassification
  FOR v_event IN 
    SELECT event_id, title, description, source_url
    FROM brand_events
    WHERE event_date > NOW() - INTERVAL '90 days'
      AND (category_code IS NULL OR category_code = 'general')
  LOOP
    -- Get the categorization result
    SELECT * INTO v_result
    FROM test_article_categorization(
      COALESCE(split_part(split_part(v_event.source_url, '/', 3), '?', 1), ''),
      COALESCE(regexp_replace(v_event.source_url, '^https?://[^/]+', ''), ''),
      v_event.title,
      COALESCE(v_event.description, '')
    );
    
    -- Update the event if we got a match
    IF v_result.category_code IS NOT NULL THEN
      UPDATE brand_events
      SET category_code = v_result.category_code,
          updated_at = NOW()
      WHERE event_id = v_event.event_id;
      
      v_updated_count := v_updated_count + 1;
      
      -- Track category counts
      IF v_result.category_code LIKE 'FIN.%' THEN
        v_financial_count := v_financial_count + 1;
      ELSIF v_result.category_code LIKE 'PRODUCT.%' THEN
        v_recall_count := v_recall_count + 1;
      ELSIF v_result.category_code LIKE 'LEGAL.%' THEN
        v_legal_count := v_legal_count + 1;
      ELSIF v_result.category_code LIKE 'REGULATORY.%' THEN
        v_regulatory_count := v_regulatory_count + 1;
      END IF;
    END IF;
  END LOOP;
  
  RETURN QUERY SELECT 
    v_updated_count,
    v_financial_count,
    v_recall_count,
    v_legal_count,
    v_regulatory_count;
END;
$$;