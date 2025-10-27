-- Add database functions for Beat Battle

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS generate_session_code();
DROP FUNCTION IF EXISTS cleanup_expired_sessions();
DROP FUNCTION IF EXISTS extend_active_sessions();

-- Function to generate a unique 6-character session code
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS VARCHAR(10) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result VARCHAR(10) := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    -- Generate 6 random characters
    FOR i IN 1..6 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM sessions WHERE session_code = result) INTO code_exists;

    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired sessions (optional, can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sessions
  WHERE expires_at < NOW()
  AND is_active = false;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to extend session expiration when there's activity
CREATE OR REPLACE FUNCTION extend_active_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- Extend expiration by 1 hour when there's activity
  NEW.expires_at := NOW() + INTERVAL '1 hour';
  NEW.last_activity_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-extend sessions on update
DROP TRIGGER IF EXISTS extend_session_on_update ON sessions;
CREATE TRIGGER extend_session_on_update
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.last_activity_at IS DISTINCT FROM NEW.last_activity_at)
  EXECUTE FUNCTION extend_active_sessions();
