-- Remove all financial/investor noise categories - focusing only on consumer-relevant events
DELETE FROM event_rules WHERE category_code LIKE 'FIN.%';