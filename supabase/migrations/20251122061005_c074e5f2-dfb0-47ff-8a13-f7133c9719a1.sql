-- Drop existing function if return type changed
DROP FUNCTION IF EXISTS personalized_brand_score(uuid, uuid);

-- Add value care columns to user_profiles if they don't exist
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS cares_labor numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cares_environment numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cares_politics numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS cares_social numeric NOT NULL DEFAULT 50;

-- Create personalized brand score function
CREATE OR REPLACE FUNCTION personalized_brand_score(
  p_brand_id uuid,
  p_user_id uuid
) RETURNS numeric AS $$
DECLARE
  bs record;
  up record;
  wL numeric;
  wE numeric;
  wP numeric;
  wS numeric;
  norm_sum numeric;
  neutral_weight numeric;
  personal_score numeric;
BEGIN
  -- Get brand scores
  SELECT * INTO bs
  FROM brand_scores
  WHERE brand_id = p_brand_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get user value profile
  SELECT cares_labor, cares_environment, cares_politics, cares_social
  INTO up
  FROM user_profiles
  WHERE user_id = p_user_id;

  -- If no profile, fall back to neutral/global score
  IF NOT FOUND THEN
    RETURN bs.score;
  END IF;

  -- Convert cares (0-100) to weights (0-1)
  wL := up.cares_labor / 100.0;
  wE := up.cares_environment / 100.0;
  wP := up.cares_politics / 100.0;
  wS := up.cares_social / 100.0;

  -- Normalize if sum > 1
  norm_sum := wL + wE + wP + wS;
  IF norm_sum > 1 THEN
    norm_sum := 1;
  END IF;

  -- Remaining weight goes to neutral (50)
  neutral_weight := 1 - norm_sum;

  -- Calculate weighted average
  personal_score :=
    (wL * bs.score_labor +
     wE * bs.score_environment +
     wP * bs.score_politics +
     wS * bs.score_social +
     neutral_weight * 50)
    / (wL + wE + wP + wS + neutral_weight);

  RETURN ROUND(personal_score);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;