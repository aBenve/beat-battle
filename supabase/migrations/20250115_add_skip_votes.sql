-- Create skip_votes table to track who voted to skip each song
CREATE TABLE IF NOT EXISTS skip_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, song_id, participant_id) -- Each participant can only vote once per song
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_skip_votes_session_song ON skip_votes(session_id, song_id);

-- Enable realtime for skip_votes
ALTER PUBLICATION supabase_realtime ADD TABLE public.skip_votes;
