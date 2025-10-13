-- Enable Realtime on BeatBattle tables
-- This allows WebSocket subscriptions to receive database change events

-- Enable Realtime on sessions table
ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;

-- Enable Realtime on participants table
ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;

-- Enable Realtime on songs table
ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;

-- Enable Realtime on scores table
ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;

-- Verify Realtime is enabled (should return 4 rows)
SELECT
  schemaname,
  tablename,
  'Realtime enabled' as status
FROM
  pg_publication_tables
WHERE
  pubname = 'supabase_realtime'
  AND schemaname = 'public'
  AND tablename IN ('sessions', 'participants', 'songs', 'scores')
ORDER BY
  tablename;

-- Expected output:
--  schemaname |   tablename   |      status
-- ------------+---------------+-----------------
--  public     | participants  | Realtime enabled
--  public     | scores        | Realtime enabled
--  public     | sessions      | Realtime enabled
--  public     | songs         | Realtime enabled
