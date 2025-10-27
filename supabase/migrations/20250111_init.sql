-- Initial schema for Beat Battle
-- Creates all base tables

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  host_id VARCHAR(255) NOT NULL,
  session_code VARCHAR(10) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'waiting',
  current_song_index INTEGER DEFAULT 0,
  current_song_started_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{"maxParticipants": 10, "allowForcePlay": true, "forcePlayCooldown": 300, "votingDuration": 30, "songsPerParticipant": 5}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participants table
CREATE TABLE IF NOT EXISTS participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  is_host BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Songs table
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  album_art TEXT,
  duration INTEGER NOT NULL,
  source VARCHAR(20) NOT NULL,
  source_id VARCHAR(255) NOT NULL,
  added_by UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(song_id, participant_id)
);

-- Force plays table
CREATE TABLE IF NOT EXISTS force_plays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_participants_session_id ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_songs_session_id ON songs(session_id);
CREATE INDEX IF NOT EXISTS idx_songs_session_position ON songs(session_id, position);
CREATE INDEX IF NOT EXISTS idx_scores_session_id ON scores(session_id);
CREATE INDEX IF NOT EXISTS idx_scores_song_id ON scores(song_id);
CREATE INDEX IF NOT EXISTS idx_force_plays_session_id ON force_plays(session_id);
CREATE INDEX IF NOT EXISTS idx_force_plays_participant_id ON force_plays(participant_id);
