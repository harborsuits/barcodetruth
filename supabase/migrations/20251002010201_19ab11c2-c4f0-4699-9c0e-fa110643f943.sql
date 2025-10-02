-- Add exclude_same_parent column to user_preferences
ALTER TABLE public.user_preferences
ADD COLUMN IF NOT EXISTS exclude_same_parent BOOLEAN NOT NULL DEFAULT true;