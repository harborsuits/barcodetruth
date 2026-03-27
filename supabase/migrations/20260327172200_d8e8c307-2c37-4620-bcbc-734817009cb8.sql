
-- Add missing relationship types to ownership_relation enum
ALTER TYPE ownership_relation ADD VALUE IF NOT EXISTS 'licensed_to';
ALTER TYPE ownership_relation ADD VALUE IF NOT EXISTS 'distributed_by';
ALTER TYPE ownership_relation ADD VALUE IF NOT EXISTS 'joint_venture_with';
ALTER TYPE ownership_relation ADD VALUE IF NOT EXISTS 'private_label_for';

-- Add missing relationship roles to ownership_role enum
ALTER TYPE ownership_role ADD VALUE IF NOT EXISTS 'licensed_to';
ALTER TYPE ownership_role ADD VALUE IF NOT EXISTS 'distributed_by';
ALTER TYPE ownership_role ADD VALUE IF NOT EXISTS 'joint_venture_with';
ALTER TYPE ownership_role ADD VALUE IF NOT EXISTS 'private_label_for';

-- Add entity_type to companies if not exists
DO $$ BEGIN
  CREATE TYPE entity_type AS ENUM ('company', 'brand', 'brand_family', 'joint_venture', 'retailer_private_label');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE companies ADD COLUMN IF NOT EXISTS entity_type entity_type DEFAULT 'company';
