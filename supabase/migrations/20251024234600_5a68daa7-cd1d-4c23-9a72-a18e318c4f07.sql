-- Update user_preferences to use 0-100 value scale
ALTER TABLE user_preferences
  DROP COLUMN IF EXISTS w_labor,
  DROP COLUMN IF EXISTS w_environment,
  DROP COLUMN IF EXISTS w_politics,
  DROP COLUMN IF EXISTS w_social,
  DROP COLUMN IF EXISTS w_verified;

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS value_labor INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS value_environment INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS value_politics INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS value_social INT DEFAULT 50;

-- Add validation triggers instead of CHECK constraints
CREATE OR REPLACE FUNCTION validate_user_values()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.value_labor < 0 OR NEW.value_labor > 100 THEN
    RAISE EXCEPTION 'value_labor must be between 0 and 100';
  END IF;
  IF NEW.value_environment < 0 OR NEW.value_environment > 100 THEN
    RAISE EXCEPTION 'value_environment must be between 0 and 100';
  END IF;
  IF NEW.value_politics < 0 OR NEW.value_politics > 100 THEN
    RAISE EXCEPTION 'value_politics must be between 0 and 100';
  END IF;
  IF NEW.value_social < 0 OR NEW.value_social > 100 THEN
    RAISE EXCEPTION 'value_social must be between 0 and 100';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS validate_user_values_trigger ON user_preferences;
CREATE TRIGGER validate_user_values_trigger
  BEFORE INSERT OR UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_values();

COMMENT ON COLUMN user_preferences.value_labor IS '0=dont care about labor, 100=deeply care about worker rights';
COMMENT ON COLUMN user_preferences.value_environment IS '0=dont care about climate, 100=deeply care about sustainability';
COMMENT ON COLUMN user_preferences.value_politics IS '0=dont care about lobbying, 100=deeply care about corporate influence';
COMMENT ON COLUMN user_preferences.value_social IS '0=prefer traditional values, 100=prefer progressive/diverse companies';