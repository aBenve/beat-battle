import { useCallback, useEffect, useState } from 'react';
import { useSessionStore } from '@/lib/store/session-store';
import type { Database } from '@/lib/supabase/database.types';

type Session = Database['public']['Tables']['sessions']['Row'];
type Song = Database['public']['Tables']['songs']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];

interface UseSkipVotingProps {
  session: Session | null;
  currentSong: Song | null;
  currentParticipant: Participant | null;
  participants: Participant[];
  isHost: boolean;
  skipAvailableAfterSeconds: number;
}

/**
 * Custom hook to handle skip voting logic
 * Manages elapsed time tracking and skip vote threshold
 */
export function useSkipVoting({
  session,
  currentSong,
  currentParticipant,
  participants,
  isHost,
  skipAvailableAfterSeconds,
}: UseSkipVotingProps) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isCheckingThreshold, setIsCheckingThreshold] = useState(false);

  const skipVotes = useSessionStore((state) => state.skipVotes);
  const addSkipVote = useSessionStore((state) => state.addSkipVote);
  const removeSkipVote = useSessionStore((state) => state.removeSkipVote);
  const nextSong = useSessionStore((state) => state.nextSong);

  // Auto-skip when threshold is reached (host only)
  useEffect(() => {
    if (!isHost || !currentSong || !session || session.status !== 'playing' || isCheckingThreshold) return;

    const songSkipVotes = skipVotes.filter((v) => v.song_id === currentSong.id);
    const skipThreshold = Math.ceil(participants.length * 0.5);

    if (songSkipVotes.length >= skipThreshold && songSkipVotes.length > 0) {
      console.log('[SkipVoting] Threshold reached via broadcast, auto-skipping...');
      setIsCheckingThreshold(true);

      // Skip to next song
      nextSong().finally(() => {
        setIsCheckingThreshold(false);
      });
    }
  }, [skipVotes, isHost, currentSong, session, participants, isCheckingThreshold]);

  // Track elapsed time for skip button availability
  useEffect(() => {
    if (!session?.current_song_started_at || session.status !== 'playing') {
      setElapsedTime(0);
      return;
    }

    // Update elapsed time every second
    const interval = setInterval(() => {
      const startTime = new Date(session.current_song_started_at!).getTime();
      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.current_song_started_at, session?.status]);

  // Handle skip voting
  const handleSkipVote = useCallback(async () => {
    if (!session || !currentParticipant || !currentSong) return;

    // Check if already voted to skip
    const hasSkipVoted = skipVotes.some(
      (v) => v.song_id === currentSong.id && v.participant_id === currentParticipant.id
    );

    if (hasSkipVoted) {
      // Remove skip vote (toggle off)
      await removeSkipVote(currentSong.id);
    } else {
      // Add skip vote
      await addSkipVote(currentSong.id);
      console.log(`[SkipVoting] Vote added for song ${currentSong.id}. Host will auto-skip when threshold is reached.`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentParticipant, currentSong, skipVotes, participants, isHost]); // Removed store functions - they're stable

  return {
    elapsedTime,
    handleSkipVote,
  };
}
