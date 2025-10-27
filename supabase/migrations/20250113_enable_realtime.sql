-- Enable Realtime on BeatBattle tables
-- This allows WebSocket subscriptions to receive database change events

-- Drop and re-add tables to publication to ensure idempotency
DO $$
BEGIN
  -- Try to drop tables from publication (ignore errors if not present)
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.sessions;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.participants;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.songs;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.scores;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Now add tables to publication
  ALTER PUBLICATION supabase_realtime ADD TABLE public.sessions;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.participants;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.songs;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.scores;
END $$;

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
