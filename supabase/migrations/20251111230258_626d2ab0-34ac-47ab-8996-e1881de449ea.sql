-- Add missing ownership_percentage column to company_shareholders
ALTER TABLE company_shareholders 
ADD COLUMN IF NOT EXISTS ownership_percentage DECIMAL(5,2);

-- Also add percent_owned if it doesn't exist (seems to be the actual column name used)
ALTER TABLE company_shareholders 
ADD COLUMN IF NOT EXISTS percent_owned DECIMAL(5,2);

-- Update TreeHouse Foods to correct QID (will update after finding correct one)
-- Placeholder: UPDATE brands SET wikidata_qid = 'CORRECT_QID' WHERE name = 'TreeHouse Foods';