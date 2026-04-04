
-- Fix all Wikimedia Commons Special:FilePath URLs to direct upload URLs
-- e.g. https://commons.wikimedia.org/wiki/Special:FilePath/Logo.svg
-- becomes https://upload.wikimedia.org/wikipedia/commons/thumb/Logo.svg
UPDATE brands 
SET logo_url = REPLACE(logo_url, 'https://commons.wikimedia.org/wiki/Special:FilePath/', 'https://upload.wikimedia.org/wikipedia/commons/thumb/')
WHERE logo_url LIKE '%commons.wikimedia.org/wiki/Special:FilePath%';
