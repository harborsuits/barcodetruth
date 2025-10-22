-- Add deduplication guard for brand events by source URL
CREATE UNIQUE INDEX IF NOT EXISTS ux_brand_events_brand_url 
ON brand_events (brand_id, source_url);

-- Add unique constraint for brand_data_mappings if it doesn't exist
CREATE UNIQUE INDEX IF NOT EXISTS ux_brand_data_mappings_source_label
ON brand_data_mappings (brand_id, source, label);

-- Insert SEC ticker mappings for major brands
-- Kroger
INSERT INTO brand_data_mappings (brand_id, source, label, external_id)
VALUES ('5e7f728b-d485-43ce-b82e-ed7c606f01d2', 'sec', 'ticker', 'KR')
ON CONFLICT (brand_id, source, label) DO UPDATE SET external_id = EXCLUDED.external_id;

-- Walmart
INSERT INTO brand_data_mappings (brand_id, source, label, external_id)
VALUES ('5b465261-bca1-41c1-9929-5ee3a8ceea61', 'sec', 'ticker', 'WMT')
ON CONFLICT (brand_id, source, label) DO UPDATE SET external_id = EXCLUDED.external_id;

-- Target
INSERT INTO brand_data_mappings (brand_id, source, label, external_id)
VALUES ('a23f7317-61db-40db-9ea3-f9eb22f8bfb8', 'sec', 'ticker', 'TGT')
ON CONFLICT (brand_id, source, label) DO UPDATE SET external_id = EXCLUDED.external_id;