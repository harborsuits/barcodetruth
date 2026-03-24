ALTER TABLE brands DROP CONSTRAINT brands_status_check;
ALTER TABLE brands ADD CONSTRAINT brands_status_check CHECK (status = ANY (ARRAY['stub','building','ready','failed','active']));