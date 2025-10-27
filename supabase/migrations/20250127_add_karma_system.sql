-- Add karma/points to participants table
ALTER TABLE participants ADD COLUMN IF NOT EXISTS karma INTEGER DEFAULT 0;

-- Add karma history table to track how points were earned/lost
CREATE TABLE IF NOT EXISTS karma_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_karma_history_participant ON karma_history(participant_id);
CREATE INDEX IF NOT EXISTS idx_karma_history_session ON karma_history(session_id);

-- Enable realtime for karma history
ALTER PUBLICATION supabase_realtime ADD TABLE karma_history;

-- Add comments
COMMENT ON COLUMN participants.karma IS 'Total karma points accumulated by participant across all sessions';
COMMENT ON TABLE karma_history IS 'History of karma points earned/lost with reasons';
