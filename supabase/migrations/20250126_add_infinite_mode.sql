-- Add infinite mode settings to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS infinite_mode BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS min_queue_size INTEGER DEFAULT 3;

-- Add comment
COMMENT ON COLUMN sessions.infinite_mode IS 'When enabled, automatically adds songs when queue is low';
COMMENT ON COLUMN sessions.min_queue_size IS 'Minimum number of songs to maintain in queue when infinite mode is enabled';
