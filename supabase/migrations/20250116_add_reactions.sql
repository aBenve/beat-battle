-- Create reactions table for real-time emoji reactions to songs
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Allow multiple reactions from same participant with different emojis
  UNIQUE(session_id, song_id, participant_id, emoji)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_reactions_session_song ON reactions(session_id, song_id);
CREATE INDEX IF NOT EXISTS idx_reactions_participant ON reactions(participant_id);

-- Enable realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
