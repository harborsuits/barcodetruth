-- Update Starbucks shareholders with source information and link them to directory
UPDATE company_shareholders cs
SET 
  source_name = 'SEC 13F',
  source_url = 'https://www.sec.gov/cgi-bin/browse-edgar',
  directory_id = sd.id
FROM shareholders_directory sd
WHERE cs.company_id = (SELECT id FROM companies WHERE name = 'Starbucks Corporation')
  AND lower(cs.holder_name) = lower(sd.display_name);