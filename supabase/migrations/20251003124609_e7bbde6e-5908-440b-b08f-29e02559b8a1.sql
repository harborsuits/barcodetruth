-- Add RLS policies for scoring config tables (read-only for all, write for admins)

-- scoring_weights policies
CREATE POLICY "Anyone can read scoring_weights"
ON scoring_weights
FOR SELECT
USING (true);

CREATE POLICY "Admins can update scoring_weights"
ON scoring_weights
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert scoring_weights"
ON scoring_weights
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- scoring_caps policies
CREATE POLICY "Anyone can read scoring_caps"
ON scoring_caps
FOR SELECT
USING (true);

CREATE POLICY "Admins can update scoring_caps"
ON scoring_caps
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert scoring_caps"
ON scoring_caps
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Ensure user_roles has proper FK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'user_roles_user_id_fkey'
  ) THEN
    ALTER TABLE user_roles
    ADD CONSTRAINT user_roles_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;
  END IF;
END $$;
