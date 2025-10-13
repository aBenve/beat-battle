-- Add session expiration and activity tracking fields
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour');

-- Create index for finding active sessions
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(status, expires_at) WHERE status != 'finished';

-- Function to update last_activity_at
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
  -- Update last_activity_at when session data changes
  UPDATE sessions
  SET last_activity_at = NOW()
  WHERE id = NEW.session_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to track activity
CREATE TRIGGER track_participant_activity
  AFTER INSERT OR UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

CREATE TRIGGER track_song_activity
  AFTER INSERT OR UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

CREATE TRIGGER track_score_activity
  AFTER INSERT ON scores
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Function to extend session expiration if there's active listening
CREATE OR REPLACE FUNCTION extend_active_sessions()
RETURNS void AS $$
BEGIN
  -- Extend expiration for sessions with 2+ participants and active playback
  UPDATE sessions s
  SET expires_at = NOW() + INTERVAL '1 hour'
  WHERE s.status = 'playing'
    AND s.last_activity_at > NOW() - INTERVAL '5 minutes'
    AND (
      SELECT COUNT(*)
      FROM participants p
      WHERE p.session_id = s.id
    ) >= 2;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS TABLE(deleted_count INTEGER) AS $$
DECLARE
  count INTEGER;
BEGIN
  -- Mark sessions as finished if expired
  UPDATE sessions
  SET status = 'finished'
  WHERE expires_at < NOW()
    AND status != 'finished';

  GET DIAGNOSTICS count = ROW_COUNT;

  RETURN QUERY SELECT count;
END;
$$ LANGUAGE plpgsql;

-- Function to count active sessions
CREATE OR REPLACE FUNCTION count_active_sessions()
RETURNS INTEGER AS $$
DECLARE
  count INTEGER;
BEGIN
  SELECT COUNT(*) INTO count
  FROM sessions
  WHERE status IN ('waiting', 'playing')
    AND expires_at > NOW();

  RETURN count;
END;
$$ LANGUAGE plpgsql;
