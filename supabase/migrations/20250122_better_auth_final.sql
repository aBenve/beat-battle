-- Better Auth Tables - FINAL VERSION
-- Uses camelCase column names as Better Auth expects

-- Drop existing tables if they exist (to recreate with correct schema)
DROP TABLE IF EXISTS "verification" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- User table (quoted identifiers to preserve camelCase)
CREATE TABLE "user" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN DEFAULT false,
  "name" TEXT,
  "image" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  -- Custom fields
  "username" TEXT UNIQUE,
  "karma" INTEGER DEFAULT 50,
  "stats" TEXT DEFAULT '{"total_sessions":0,"songs_added":0,"avg_rating":0}'
);

-- Session table (quoted identifiers to preserve camelCase)
CREATE TABLE "session" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW(),
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

-- Account table (for OAuth providers) (quoted identifiers to preserve camelCase)
CREATE TABLE "account" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMPTZ,
  "refreshTokenExpiresAt" TIMESTAMPTZ,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Verification table (quoted identifiers to preserve camelCase)
CREATE TABLE "verification" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_user_email ON "user"("email");
CREATE INDEX idx_user_username ON "user"("username");
CREATE INDEX idx_session_userId ON "session"("userId");
CREATE INDEX idx_session_token ON "session"("token");
CREATE INDEX idx_account_userId ON "account"("userId");
CREATE INDEX idx_verification_identifier ON "verification"("identifier");

-- Enable Row Level Security
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for now - tighten in production)
CREATE POLICY "Allow all operations on user" ON "user"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on session" ON "session"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on account" ON "account"
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on verification" ON "verification"
  FOR ALL USING (true) WITH CHECK (true);

-- Link participants table to users
ALTER TABLE participants ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES "user"(id) ON DELETE SET NULL;
ALTER TABLE participants ALTER COLUMN user_name DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);

COMMENT ON COLUMN participants.user_id IS 'Links to authenticated user. NULL for guest participants.';
COMMENT ON COLUMN participants.user_name IS 'Display name for this session. Required for guests, optional for authenticated users.';
