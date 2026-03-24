
-- Set parent companies for famous brands (using parent_company text column)
UPDATE brands SET parent_company = 'Campbell Soup Company' WHERE id = 'b6e6b602-55eb-46ea-871a-a02ce2e99880';
UPDATE brands SET parent_company = 'The Coca-Cola Company' WHERE id = '23f8caea-811f-44bd-bd53-ec6253278ef5';
UPDATE brands SET parent_company = 'Mondelez International' WHERE id = 'b7b14369-5f0c-41ca-9449-5f13997fe603';

-- Approve obvious correct fuzzy matches
UPDATE fuzzy_alias_review SET status = 'approved' WHERE external_name IN (
  'Ocean Sprqy', 'Nescafe', 'Body Armor', 'Chobani flip', 
  'THAI KITCHEN', 'Nature Valley', 'BLUE BELL', 
  'Milo''s Tea Company Inc.', 'Kikkoman Panko', 'Great Value Organic',
  'Kirkland Signature Ocean Spray', 'Nature''s Path Organic'
);

-- Reject bad fuzzy matches and clean up aliases
UPDATE fuzzy_alias_review SET status = 'rejected' WHERE external_name = 'Ben''s Original' AND matched_brand_name = 'Original';
UPDATE fuzzy_alias_review SET status = 'rejected' WHERE external_name = 'MAYORGA organics' AND matched_brand_name = 'MALK Organics';
UPDATE fuzzy_alias_review SET status = 'rejected' WHERE external_name = 'nutrail' AND matched_brand_name = 'nutraiu';
DELETE FROM brand_aliases WHERE external_name = 'Ben''s Original' AND source = 'openfoodfacts_fuzzy';
DELETE FROM brand_aliases WHERE external_name = 'MAYORGA organics' AND source = 'openfoodfacts_fuzzy';
DELETE FROM brand_aliases WHERE external_name = 'nutrail' AND source = 'openfoodfacts_fuzzy';

-- Create correct brand entries for rejected ones
INSERT INTO brands (name) VALUES ('Ben''s Original'), ('Mayorga Organics'), ('Nutrail') ON CONFLICT DO NOTHING
