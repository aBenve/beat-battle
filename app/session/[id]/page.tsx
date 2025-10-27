'use client';

import AddSongDialog from '@/components/session/add-song-dialog';
import SessionResults from '@/components/session/session-results';
import SessionHeader from '@/components/session/session-header';
import PlayingView from '@/components/session/playing-view';
import WaitingView from '@/components/session/waiting-view';
import { useSessionStore } from '@/lib/store/session-store';
import { useSessionInit } from '@/hooks/use-session-init';
import { useSkipVoting } from '@/hooks/use-skip-voting';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function SessionPage() {
  const params = useParams();
  const sessionId = params.id as string;

  // Initialize session (loads data and sets up realtime)
  const { isLoading } = useSessionInit(sessionId);

  // Use selective subscriptions to prevent unnecessary re-renders
  const session = useSessionStore((state) => state.session);
  const participants = useSessionStore((state) => state.participants);
  const songs = useSessionStore((state) => state.songs);
  const scores = useSessionStore((state) => state.scores);
  const skipVotes = useSessionStore((state) => state.skipVotes);
  const reactions = useSessionStore((state) => state.reactions);
  // chatMessages removed - now handled by ChatMessagesContainer to prevent re-renders
  const currentParticipant = useSessionStore((state) => state.currentParticipant);
  const onlineUsers = useSessionStore((state) => state.onlineUsers);

  // Actions don't cause re-renders
  const setCurrentParticipant = useSessionStore((state) => state.setCurrentParticipant);
  const addScore = useSessionStore((state) => state.addScore);
  const addSong = useSessionStore((state) => state.addSong);
  const addReaction = useSessionStore((state) => state.addReaction);
  const removeReaction = useSessionStore((state) => state.removeReaction);
  const updateSession = useSessionStore((state) => state.updateSession);
  const nextSong = useSessionStore((state) => state.nextSong);
  const shuffleQueue = useSessionStore((state) => state.shuffleQueue);
  const toggleInfiniteMode = useSessionStore((state) => state.toggleInfiniteMode);

  const [currentRating, setCurrentRating] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);

  // Memoize computed values
  const currentSong = useMemo(
    () => session && session.current_song_index !== null ? songs[session.current_song_index] : null,
    [session, songs]
  );

  const isHost = useMemo(
    () => currentParticipant?.is_host || false,
    [currentParticipant]
  );

  // Skip button settings
  const SKIP_AVAILABLE_AFTER_SECONDS = 30;

  // Use skip voting hook (manages elapsed time and skip vote logic)
  const { elapsedTime, handleSkipVote } = useSkipVoting({
    session,
    currentSong,
    currentParticipant,
    participants,
    isHost,
    skipAvailableAfterSeconds: SKIP_AVAILABLE_AFTER_SECONDS,
  });

  // Sync current participant when participants list updates
  useEffect(() => {
    const participantId = localStorage.getItem('participantId');
    if (participantId && participants.length > 0) {
      const participant = participants.find((p) => p.id === participantId);
      if (participant) {
        setCurrentParticipant(participant);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants]);

  useEffect(() => {
    // Check if user has already voted for current song
    if (session && session.current_song_index !== null && songs.length > 0 && currentParticipant) {
      const currentSong = songs[session.current_song_index];
      if (currentSong) {
        const existingScore = scores.find(
          (s) => s.song_id === currentSong.id && s.participant_id === currentParticipant.id
        );
        setHasVoted(!!existingScore);
        if (existingScore) {
          setCurrentRating(existingScore.rating);
        } else {
          // Reset rating when song changes
          setCurrentRating(0);
        }

        // Chat messages now loaded by ChatMessagesContainer
      }
    }
  }, [session, songs, currentParticipant, scores]);

  const handleCopyCode = () => {
    if (session) {
      navigator.clipboard.writeText(session.session_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleVote = useCallback(async (rating: number) => {
    if (!session || session.current_song_index === null || !currentParticipant || hasVoted) return;

    const currentSong = songs[session.current_song_index];
    if (!currentSong) return;

    await addScore({
      session_id: session.id,
      song_id: currentSong.id,
      participant_id: currentParticipant.id,
      rating,
    });
    setCurrentRating(rating);
    setHasVoted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, currentParticipant, hasVoted, songs]); // Removed addScore - store functions stable

  const handleSongEnd = useCallback(async () => {
    console.log('Song ended, is host:', currentParticipant?.is_host);
    // Only host can advance to next song
    if (currentParticipant?.is_host) {
      try {
        await nextSong();
        console.log('Advanced to next song');
      } catch (error) {
        console.error('Error advancing to next song:', error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentParticipant]); // Removed nextSong - store functions stable

  const handleAddSong = async (song: {
    id: string;
    title: string;
    artist: string;
    thumbnail: string;
    duration: number;
  }) => {
    console.log('handleAddSong called', { session, currentParticipant, song });

    if (!session) {
      const error = 'No session found';
      console.error(error);
      throw new Error(error);
    }

    if (!currentParticipant) {
      const error = 'No current participant found';
      console.error(error);
      throw new Error(error);
    }

    // Check for duplicate songs (same YouTube video ID)
    const isDuplicate = songs.some((s) => s.source_id === song.id);
    if (isDuplicate) {
      const error = 'This song is already in the queue';
      console.error(error);
      throw new Error(error);
    }

    try {
      const songData = {
        session_id: session.id,
        title: song.title,
        artist: song.artist,
        album_art: song.thumbnail,
        duration: song.duration,
        source: 'youtube' as const,
        source_id: song.id,
        added_by: currentParticipant.id,
        position: songs.length,
      };

      console.log('Adding song to database:', songData);
      await addSong(songData);
      console.log('Song added successfully to database');
    } catch (error) {
      console.error('Error adding song to database:', error);
      throw error;
    }
  };

  const handleStartSession = async () => {
    if (!session || !isHost || songs.length === 0) return;

    try {
      // Shuffle the queue before starting
      await shuffleQueue();

      // Start the session with the first song (after shuffle)
      await updateSession({
        status: 'playing',
        current_song_index: 0,
        current_song_started_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  const handleFinishSession = async () => {
    if (!session || !isHost) return;

    const confirmed = window.confirm(
      'Are you sure you want to end this session? This will show the final results.'
    );

    if (!confirmed) return;

    try {
      await updateSession({
        status: 'finished',
      });
    } catch (error) {
      console.error('Error finishing session:', error);
    }
  };

  // Calculate initial playback position when song loads - only compute once per song
  const initialPlaybackTime = useMemo(() => {
    if (!session?.current_song_started_at) return 0;
    const startTime = new Date(session.current_song_started_at).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    return elapsed;
  }, [session?.current_song_started_at]); // Only recalculate when song changes

  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p>Loading session...</p>
        </div>
      </div>
    );
  }

  // Show results if session is finished
  if (session.status === 'finished') {
    console.log('[SessionPage] Rendering results. Participants:', participants.length, participants);
    return (
      <SessionResults
        session={session}
        participants={participants}
        songs={songs}
        scores={scores}
      />
    );
  }

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-5xl mx-auto">
        {/* Session Header */}
        <SessionHeader
          sessionName={session.name}
          sessionCode={session.session_code}
          copiedCode={copiedCode}
          infiniteMode={session.infinite_mode ?? false}
          onCopyCode={handleCopyCode}
          onAddSong={() => setShowAddSong(true)}
          onShuffleQueue={shuffleQueue}
          onToggleInfiniteMode={toggleInfiniteMode}
          onFinishSession={handleFinishSession}
          isHost={isHost}
          isPlaying={session.status === 'playing'}
          onlineUsers={onlineUsers}
          currentUserId={currentParticipant?.id}
        />

        {/* Playing View */}
        {session.status === 'playing' && currentSong ? (
          <PlayingView
            currentSong={currentSong}
            songs={songs}
            participants={participants}
            scores={scores}
            skipVotes={skipVotes}
            reactions={reactions}
            currentParticipant={currentParticipant}
            currentSongIndex={session.current_song_index}
            sessionStartedAt={session.current_song_started_at}
            initialPlaybackTime={initialPlaybackTime}
            currentRating={currentRating}
            hasVoted={hasVoted}
            elapsedTime={elapsedTime}
            skipAvailableAfterSeconds={SKIP_AVAILABLE_AFTER_SECONDS}
            onSongEnd={handleSongEnd}
            onVote={handleVote}
            onSkipVote={handleSkipVote}
            onAddReaction={addReaction}
            onRemoveReaction={removeReaction}
          />
        ) : (
          <WaitingView
            songs={songs}
            participants={participants}
            isHost={isHost}
            onStartSession={handleStartSession}
            onAddSong={() => setShowAddSong(true)}
          />
        )}

        {/* Add Song Dialog */}
        <AddSongDialog
          open={showAddSong}
          onOpenChange={setShowAddSong}
          onAddSong={handleAddSong}
          existingSongs={songs}
        />
      </div>
    </div>
  );
}
