
-- event_votes table for community validation
CREATE TABLE IF NOT EXISTS public.event_votes (
  vote_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.brand_events(event_id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  vote smallint NOT NULL CHECK (vote IN (-1, 1)),
  vote_reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

-- Denormalized vote counts on brand_events
ALTER TABLE public.brand_events ADD COLUMN IF NOT EXISTS upvotes int DEFAULT 0;
ALTER TABLE public.brand_events ADD COLUMN IF NOT EXISTS downvotes int DEFAULT 0;
ALTER TABLE public.brand_events ADD COLUMN IF NOT EXISTS community_multiplier float DEFAULT 1.0;

-- Trigger to sync vote counts
CREATE OR REPLACE FUNCTION public.sync_vote_counts()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.brand_events SET
    upvotes   = (SELECT count(*) FROM public.event_votes WHERE event_id = coalesce(NEW.event_id, OLD.event_id) AND vote = 1),
    downvotes = (SELECT count(*) FROM public.event_votes WHERE event_id = coalesce(NEW.event_id, OLD.event_id) AND vote = -1)
  WHERE event_id = coalesce(NEW.event_id, OLD.event_id);
  RETURN coalesce(NEW, OLD);
END;
$$;

CREATE TRIGGER event_votes_sync
AFTER INSERT OR UPDATE OR DELETE ON public.event_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_vote_counts();

-- RLS on event_votes
ALTER TABLE public.event_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read vote counts
CREATE POLICY "Anyone can read votes" ON public.event_votes
  FOR SELECT USING (true);

-- Authenticated users can insert their own votes
CREATE POLICY "Users can insert own votes" ON public.event_votes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own votes
CREATE POLICY "Users can update own votes" ON public.event_votes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own votes
CREATE POLICY "Users can delete own votes" ON public.event_votes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_event_votes_event_id ON public.event_votes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_votes_user_id ON public.event_votes(user_id);
