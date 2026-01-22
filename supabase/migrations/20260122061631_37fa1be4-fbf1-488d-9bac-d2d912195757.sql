-- Create Keurig Dr Pepper as a brand (if not exists)
INSERT INTO brands (name, slug, ticker, wikidata_qid, company_type, is_active)
SELECT 'Keurig Dr Pepper', 'keurig-dr-pepper', 'KDP', 'Q29514595', 'public', true
WHERE NOT EXISTS (SELECT 1 FROM brands WHERE slug = 'keurig-dr-pepper');