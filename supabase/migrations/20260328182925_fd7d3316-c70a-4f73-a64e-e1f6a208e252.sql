
-- Promote Kraft to active status
UPDATE brands SET status = 'active', logo_url = 'https://commons.wikimedia.org/wiki/Special:FilePath/KraftHeinz.svg'
WHERE id = '9d35a3cb-7302-4222-9080-840920ba55d1';

-- Promote Kraft Singles to active status  
UPDATE brands SET status = 'active' WHERE id = '81a106dc-f127-4429-9168-d527db8029b5';

-- Link Kraft to Kraft Heinz as parent
INSERT INTO brand_ownerships (brand_id, parent_brand_id, relationship_type, source)
VALUES ('9d35a3cb-7302-4222-9080-840920ba55d1', 'dca50aec-af0d-4afb-812a-15ef77747b69', 'subsidiary_of', 'manual')
ON CONFLICT DO NOTHING;

-- Link Kraft Singles to Kraft Heinz as parent
INSERT INTO brand_ownerships (brand_id, parent_brand_id, relationship_type, source)
VALUES ('81a106dc-f127-4429-9168-d527db8029b5', 'dca50aec-af0d-4afb-812a-15ef77747b69', 'subsidiary_of', 'manual')
ON CONFLICT DO NOTHING;
