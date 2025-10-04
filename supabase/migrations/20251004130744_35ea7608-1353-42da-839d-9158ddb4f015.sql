-- 1. Add unique constraint + helpful indexes on event_sources
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'event_sources_eventid_canonical_uniq'
  ) THEN
    ALTER TABLE event_sources
      ADD CONSTRAINT event_sources_eventid_canonical_uniq
      UNIQUE (event_id, canonical_url);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS event_sources_regdomain_idx
  ON event_sources(registrable_domain);

CREATE INDEX IF NOT EXISTS event_sources_sourceurl_idx
  ON event_sources(source_url);

-- 2. Set default timestamp on source_date
ALTER TABLE event_sources
  ALTER COLUMN source_date SET DEFAULT now();

-- 3. Seed source_credibility with top 20+ high-signal domains
-- Note: source_credibility table already exists with columns: source_name, base_credibility, dynamic_adjustment
INSERT INTO source_credibility (source_name, base_credibility, dynamic_adjustment, notes) VALUES
  ('reuters.com', 0.95, 0.00, 'Reuters - Top tier wire service'),
  ('apnews.com', 0.95, 0.00, 'Associated Press - Top tier wire service'),
  ('bbc.com', 0.92, 0.00, 'BBC - Public broadcaster'),
  ('nytimes.com', 0.90, 0.00, 'New York Times'),
  ('washingtonpost.com', 0.90, 0.00, 'Washington Post'),
  ('wsj.com', 0.90, 0.00, 'Wall Street Journal'),
  ('theguardian.com', 0.90, 0.00, 'The Guardian'),
  ('ft.com', 0.90, 0.00, 'Financial Times'),
  ('npr.org', 0.88, 0.00, 'NPR - Public radio'),
  ('bloomberg.com', 0.88, 0.00, 'Bloomberg - Financial news'),
  ('cnbc.com', 0.85, 0.00, 'CNBC'),
  ('politico.com', 0.85, 0.00, 'POLITICO'),
  ('cnn.com', 0.80, 0.00, 'CNN'),
  ('nbcnews.com', 0.80, 0.00, 'NBC News'),
  ('abcnews.go.com', 0.80, 0.00, 'ABC News'),
  ('cbsnews.com', 0.80, 0.00, 'CBS News'),
  ('aljazeera.com', 0.85, 0.00, 'Al Jazeera'),
  ('nature.com', 0.92, 0.00, 'Nature - Peer-reviewed journal'),
  ('science.org', 0.92, 0.00, 'Science (AAAS) - Peer-reviewed journal'),
  ('fda.gov', 0.98, 0.00, 'U.S. FDA - Official government'),
  ('cdc.gov', 0.98, 0.00, 'CDC - Official government'),
  ('nih.gov', 0.98, 0.00, 'NIH - Official government')
ON CONFLICT (source_name) DO UPDATE
SET base_credibility = EXCLUDED.base_credibility,
    dynamic_adjustment = EXCLUDED.dynamic_adjustment,
    notes = EXCLUDED.notes,
    updated_at = now();