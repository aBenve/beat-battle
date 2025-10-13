-- BeatBattle Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  host_id UUID NOT NULL,
  session_code VARCHAR(10) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
  current_song_index INTEGER DEFAULT 0,
  current_song_started_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour'),
  settings JSONB DEFAULT '{
    "maxParticipants": 10,
    "allowForcePlay": true,
    "forcePlayCooldown": 300,
    "votingDuration": 30,
    "songsPerParticipant": 5
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants table
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Songs table
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  album_art TEXT,
  duration INTEGER NOT NULL, -- in seconds
  source VARCHAR(20) NOT NULL CHECK (source IN ('spotify', 'youtube')),
  source_id VARCHAR(255) NOT NULL, -- Spotify track ID or YouTube video ID
  added_by UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, participant_id) -- Each participant can only vote once per song
);

-- Force plays table (tracks when participants use force-play)
CREATE TABLE IF NOT EXISTS force_plays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_sessions_code ON sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_participants_session ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_songs_session ON songs(session_id);
CREATE INDEX IF NOT EXISTS idx_songs_position ON songs(session_id, position);
CREATE INDEX IF NOT EXISTS idx_scores_session ON scores(session_id);
CREATE INDEX IF NOT EXISTS idx_scores_song ON scores(song_id);
CREATE INDEX IF NOT EXISTS idx_force_plays_session ON force_plays(session_id);
CREATE INDEX IF NOT EXISTS idx_force_plays_participant ON force_plays(participant_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to sessions table
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE force_plays ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Allow all operations for now - you can restrict later)
-- Sessions
CREATE POLICY "Allow all operations on sessions" ON sessions
  FOR ALL USING (true) WITH CHECK (true);

-- Participants
CREATE POLICY "Allow all operations on participants" ON participants
  FOR ALL USING (true) WITH CHECK (true);

-- Songs
CREATE POLICY "Allow all operations on songs" ON songs
  FOR ALL USING (true) WITH CHECK (true);

-- Scores
CREATE POLICY "Allow all operations on scores" ON scores
  FOR ALL USING (true) WITH CHECK (true);

-- Force plays
CREATE POLICY "Allow all operations on force_plays" ON force_plays
  FOR ALL USING (true) WITH CHECK (true);

-- Function to generate unique session code
CREATE OR REPLACE FUNCTION generate_session_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate random 6-character alphanumeric code
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));

    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM sessions WHERE session_code = code) INTO exists;

    EXIT WHEN NOT exists;
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- View to get session leaderboard
CREATE OR REPLACE VIEW session_leaderboard AS
SELECT
  p.session_id,
  p.id as participant_id,
  p.user_name,
  p.avatar_url,
  COUNT(DISTINCT songs_added.id) as songs_added,
  COALESCE(AVG(scores.rating), 0) as average_score,
  COUNT(DISTINCT scores.id) as total_votes_received
FROM participants p
LEFT JOIN songs songs_added ON songs_added.added_by = p.id
LEFT JOIN scores ON scores.song_id = songs_added.id AND scores.participant_id != p.id
JOIN sessions s ON s.id = p.session_id
GROUP BY p.session_id, p.id, p.user_name, p.avatar_url
ORDER BY average_score DESC;
