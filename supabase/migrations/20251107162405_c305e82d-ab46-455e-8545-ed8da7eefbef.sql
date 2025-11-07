
-- Phase 1: Add quality tracking to company_ownership table
ALTER TABLE company_ownership 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'wikidata',
ADD COLUMN IF NOT EXISTS confidence numeric DEFAULT 0.8,
ADD COLUMN IF NOT EXISTS last_verified timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS is_validated boolean DEFAULT false;

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_ownership_source ON company_ownership(source);
CREATE INDEX IF NOT EXISTS idx_ownership_confidence ON company_ownership(confidence);
CREATE INDEX IF NOT EXISTS idx_ownership_validated ON company_ownership(is_validated);

-- Mark existing valid Wikidata relationships
UPDATE company_ownership
SET is_validated = true
WHERE source = 'wikidata'
  AND parent_name !~* '(patent|trademark|article of|product of|method of|system|apparatus|device for|component)';

COMMENT ON COLUMN company_ownership.source IS 'Data source: wikidata, sec, opencorporates, manual';
COMMENT ON COLUMN company_ownership.confidence IS 'Confidence score 0.0-1.0 for this relationship';
COMMENT ON COLUMN company_ownership.is_validated IS 'Whether this relationship has been validated by AI or human review';
