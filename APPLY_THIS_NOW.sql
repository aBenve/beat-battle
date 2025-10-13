-- ===================================================================
-- QUICK FIX: Run this in Supabase SQL Editor NOW
-- ===================================================================
-- This will fix the "count_active_sessions function not found" error
-- Copy and paste this entire file into Supabase SQL Editor and run it
-- ===================================================================

-- Step 1: Add new columns to sessions table
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour');

-- Step 2: Update existing sessions to have expiration
UPDATE sessions
SET expires_at = COALESCE(expires_at, created_at + INTERVAL '1 hour')
WHERE expires_at IS NULL;

UPDATE sessions
SET last_activity_at = COALESCE(last_activity_at, updated_at, created_at)
WHERE last_activity_at IS NULL;

-- Step 3: Create the count_active_sessions function
CREATE OR REPLACE FUNCTION count_active_sessions()
RETURNS INTEGER AS $$
DECLARE
  session_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO session_count
  FROM sessions
  WHERE status IN ('waiting', 'playing')
    AND expires_at > NOW();

  RETURN session_count;
END;
$$ LANGUAGE plpgsql;

-- Step 4: Create other helper functions
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

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Mark sessions as finished if expired
  UPDATE sessions
  SET status = 'finished'
  WHERE expires_at < NOW()
    AND status != 'finished';

  GET DIAGNOSTICS affected_count = ROW_COUNT;

  RETURN affected_count;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create activity tracking function
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

-- Step 6: Create triggers for activity tracking
DROP TRIGGER IF EXISTS track_participant_activity ON participants;
CREATE TRIGGER track_participant_activity
  AFTER INSERT OR UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

DROP TRIGGER IF EXISTS track_song_activity ON songs;
CREATE TRIGGER track_song_activity
  AFTER INSERT OR UPDATE ON songs
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

DROP TRIGGER IF EXISTS track_score_activity ON scores;
CREATE TRIGGER track_score_activity
  AFTER INSERT ON scores
  FOR EACH ROW
  EXECUTE FUNCTION update_session_activity();

-- Step 7: Create index for performance
CREATE INDEX IF NOT EXISTS idx_sessions_active
  ON sessions(status, expires_at)
  WHERE status != 'finished';

-- ===================================================================
-- VERIFICATION: Test that functions work
-- ===================================================================

-- Test count_active_sessions
SELECT count_active_sessions() as active_session_count;

-- Show current sessions
SELECT
  id,
  name,
  status,
  created_at,
  expires_at,
  last_activity_at,
  (expires_at > NOW()) as is_active
FROM sessions
ORDER BY created_at DESC
LIMIT 10;

-- ===================================================================
-- SUCCESS! You can now create sessions without errors
-- ===================================================================
