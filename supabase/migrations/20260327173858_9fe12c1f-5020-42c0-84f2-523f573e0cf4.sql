
-- Drop the old restrictive check constraint and replace with expanded one
ALTER TABLE company_ownership DROP CONSTRAINT company_ownership_relation_chk;

ALTER TABLE company_ownership ADD CONSTRAINT company_ownership_relation_chk
CHECK (relationship IN (
  'parent','subsidiary','parent_organization','owned_by',
  'subsidiary_of','brand_owner','ultimate_operating_parent','legal_parent',
  'major_shareholder','private_equity_sponsor',
  'joint_venture_with','licensed_to','distributed_by','private_label_for'
));
