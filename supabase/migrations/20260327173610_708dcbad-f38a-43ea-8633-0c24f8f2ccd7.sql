
-- Update trigger to allow all valid ownership_relation enum values
CREATE OR REPLACE FUNCTION trg_company_ownership_only_control()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow all valid ownership relationship types
  IF NEW.relationship NOT IN (
    'parent','subsidiary','parent_organization','owned_by',
    'subsidiary_of','brand_owner','ultimate_operating_parent','legal_parent',
    'major_shareholder','private_equity_sponsor',
    'joint_venture_with','licensed_to','distributed_by','private_label_for'
  ) THEN
    RAISE EXCEPTION 'Invalid relationship for control chain: %', NEW.relationship;
  END IF;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;
