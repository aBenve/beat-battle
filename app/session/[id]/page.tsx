'use client';

import AddSongDialog from '@/components/session/add-song-dialog';
import SessionResults from '@/components/session/session-results';
import VotingStars from '@/components/session/voting-stars';
import YouTubePlayerComponent from '@/components/session/youtube-player';
import OnlineUsers from '@/components/session/online-users';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSessionStore } from '@/lib/store/session-store';
import { Flag, Music, Play, Star } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

export default function SessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  // Use selective subscriptions to prevent unnecessary re-renders
  const session = useSessionStore((state) => state.session);
  const participants = useSessionStore((state) => state.participants);
  const songs = useSessionStore((state) => state.songs);
  const scores = useSessionStore((state) => state.scores);
  const currentParticipant = useSessionStore((state) => state.currentParticipant);
  const onlineUsers = useSessionStore((state) => state.onlineUsers);

  // Actions don't cause re-renders
  const loadSession = useSessionStore((state) => state.loadSession);
  const subscribeToSession = useSessionStore((state) => state.subscribeToSession);
  const unsubscribeFromSession = useSessionStore((state) => state.unsubscribeFromSession);
  const setCurrentParticipant = useSessionStore((state) => state.setCurrentParticipant);
  const nextSong = useSessionStore((state) => state.nextSong);
  const addScore = useSessionStore((state) => state.addScore);
  const addSong = useSessionStore((state) => state.addSong);
  const updateSession = useSessionStore((state) => state.updateSession);

  const [isLoading, setIsLoading] = useState(true);
  const [currentRating, setCurrentRating] = useState(0);
  const [hasVoted, setHasVoted] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        // Get participant from localStorage
        const participantId = localStorage.getItem('participantId');
        if (!participantId) {
          router.push('/');
          return;
        }

        // 1. Load session data first
        await loadSession(sessionId);

        // 2. Set current participant (needed for presence tracking)
        const storeParticipants = useSessionStore.getState().participants;
        const participant = storeParticipants.find((p) => p.id === participantId);
        if (participant) {
          setCurrentParticipant(participant);
        }

        // 3. Subscribe to real-time updates (AFTER participant is set)
        await subscribeToSession(sessionId);

        setIsLoading(false);
      } catch (error) {
        console.error('Error initializing session:', error);
        router.push('/');
      }
    };

    init();

    return () => {
      unsubscribeFromSession();
    };
  }, [sessionId, loadSession, subscribeToSession, unsubscribeFromSession, setCurrentParticipant, router]);

  useEffect(() => {
    // Set current participant from localStorage
    const participantId = localStorage.getItem('participantId');
    if (participantId && participants.length > 0) {
      const participant = participants.find((p) => p.id === participantId);
      if (participant) {
        setCurrentParticipant(participant);
      }
    }
  }, [participants, setCurrentParticipant]);

  useEffect(() => {
    // Check if user has already voted for current song
    if (session && songs.length > 0 && currentParticipant) {
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
    if (!session || !currentParticipant || hasVoted) return;

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
  }, [session, currentParticipant, hasVoted, songs, addScore]);

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
  }, [currentParticipant, nextSong]);

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

  // Memoize computed values
  const currentSong = useMemo(
    () => session ? songs[session.current_song_index] : null,
    [session, songs]
  );

  const isHost = useMemo(
    () => currentParticipant?.is_host || false,
    [currentParticipant]
  );

  // Calculate current playback position for sync - memoized
  const getCurrentPlaybackTime = useCallback(() => {
    if (!session?.current_song_started_at) return 0;
    const startTime = new Date(session.current_song_started_at).getTime();
    const now = Date.now();
    const elapsed = Math.floor((now - startTime) / 1000);
    return elapsed;
  }, [session?.current_song_started_at]);

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
        {/* Minimal Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{session.name}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyCode}
              className="text-xs"
            >
              {copiedCode ? 'Copied!' : session.session_code}
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <OnlineUsers
              users={onlineUsers}
              currentUserId={currentParticipant?.id}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAddSong(true)}
            >
              <Music className="h-4 w-4" />
            </Button>
            {isHost && session.status === 'playing' && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleFinishSession}
              >
                <Flag className="h-4 w-4 mr-2" />
                Finish
              </Button>
            )}
          </div>
        </div>

        {/* Video Player - Full Focus */}
        {session.status === 'playing' && currentSong ? (
          <div className="space-y-4">
            <Card className="border-0 p-0">
              <CardContent className="p-0">
                {currentSong.source === 'youtube' && (
                  <YouTubePlayerComponent
                    key={currentSong.id}
                    videoId={currentSong.source_id}
                    onEnd={handleSongEnd}
                    autoplay={true}
                    startTime={getCurrentPlaybackTime()}
                    sessionStartedAt={session.current_song_started_at || undefined}
                  />
                )}
              </CardContent>
            </Card>

            {/* Song Info & Voting - Inline */}
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{currentSong.title}</div>
                <div className="text-sm text-muted-foreground truncate">{currentSong.artist}</div>
              </div>
              <VotingStars
                currentRating={currentRating}
                hasVoted={hasVoted}
                onVote={handleVote}
              />
            </div>

            {/* Queue - Full List */}
            <div className="mt-8">
              <div className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
                Queue ({songs.length} songs)
              </div>
              <div className="space-y-2">
                {songs.map((song, index) => {
                  const addedBy = participants.find((p) => p.id === song.added_by);
                  const isCurrentSong = index === session.current_song_index;
                  const isPastSong = index < session.current_song_index;

                  // Get all scores for this song
                  const songScores = scores.filter((s) => s.song_id === song.id);
                  const avgScore = songScores.length > 0
                    ? (songScores.reduce((sum, s) => sum + s.rating, 0) / songScores.length).toFixed(1)
                    : null;

                  return (
                    <div
                      key={song.id}
                      className={`flex items-center gap-3 p-3 rounded-lg ${
                        isCurrentSong
                          ? 'bg-secondary'
                          : isPastSong
                          ? 'opacity-50'
                          : 'bg-card'
                      }`}
                    >
                      <div className="text-sm font-semibold w-6">{index + 1}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">{song.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {song.artist} · {addedBy?.user_name}
                        </div>
                      </div>
                      {avgScore && (
                        <div className="flex items-center gap-1 text-sm">
                          <Star className="h-3 w-3 fill-white text-white" />
                          <span>{avgScore}</span>
                          <span className="text-xs text-muted-foreground">({songScores.length})</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Waiting State */}
            <div className="flex items-center justify-center py-20">
              <div className="text-center space-y-4">
                <Music className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-lg font-semibold">Waiting to start</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isHost ? 'Add songs and start the session' : 'The host will start soon'}
                  </p>
                </div>
                {isHost && songs.length > 0 && (
                  <Button onClick={handleStartSession}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Session
                  </Button>
                )}
              </div>
            </div>

            {/* Queue for Waiting State */}
            {songs.length > 0 && (
              <div>
                <div className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
                  Queue ({songs.length} songs)
                </div>
                <div className="space-y-2">
                  {songs.map((song, index) => {
                    const addedBy = participants.find((p) => p.id === song.added_by);

                    return (
                      <div
                        key={song.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-card"
                      >
                        <div className="text-sm font-semibold w-6">{index + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate text-sm">{song.title}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {song.artist} · {addedBy?.user_name}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add Song Dialog */}
        <AddSongDialog
          open={showAddSong}
          onOpenChange={setShowAddSong}
          onAddSong={handleAddSong}
        />
      </div>
    </div>
  );
}
