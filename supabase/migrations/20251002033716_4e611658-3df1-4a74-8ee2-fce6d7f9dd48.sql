-- Remove test/placeholder brands
DELETE FROM brand_scores WHERE brand_id IN (
  SELECT id FROM brands WHERE name IN ('CleanCo', 'EcoWash', 'FreshClean', 'PureDetergent')
);

DELETE FROM brands WHERE name IN ('CleanCo', 'EcoWash', 'FreshClean', 'PureDetergent');