
-- Fix malformed brand slugs
UPDATE brands 
SET slug = lower(
  trim(both '-' from 
    regexp_replace(
      regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  )
)
WHERE slug != lower(
  trim(both '-' from 
    regexp_replace(
      regexp_replace(name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  )
);

-- Fix ConAgra specifically
UPDATE brands 
SET slug = 'conagra-brands'
WHERE name = 'ConAgra Brands' AND slug = 'on-gra-rands';
