'use client';

import ChatMessagesContainer from '@/components/session/chat-messages-container';
import SongProgressBar from '@/components/session/song-progress-bar';
import SongQueueList from '@/components/session/song-queue-list';
import SongReactions from '@/components/session/song-reactions';
import VotingStars from '@/components/session/voting-stars';
import YouTubePlayerComponent from '@/components/session/youtube-player';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Database } from '@/lib/supabase/database.types';
import { SkipForward } from 'lucide-react';
import { memo } from 'react';

type Song = Database['public']['Tables']['songs']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];
type Score = Database['public']['Tables']['scores']['Row'];
type SkipVote = Database['public']['Tables']['skip_votes']['Row'];
type Reaction = Database['public']['Tables']['reactions']['Row'];

interface PlayingViewProps {
  currentSong: Song;
  songs: Song[];
  participants: Participant[];
  scores: Score[];
  skipVotes: SkipVote[];
  reactions: Reaction[];
  currentParticipant: Participant | null;
  currentSongIndex: number | null;
  sessionStartedAt: string | null;
  initialPlaybackTime: number;
  currentRating: number;
  hasVoted: boolean;
  elapsedTime: number;
  skipAvailableAfterSeconds: number;
  onSongEnd: () => void;
  onVote: (rating: number) => Promise<void>;
  onSkipVote: () => void;
  onAddReaction: (songId: string, emoji: string) => Promise<void>;
  onRemoveReaction: (songId: string, emoji: string) => Promise<void>;
}

const PlayingView = memo(function PlayingView({
  currentSong,
  songs,
  participants,
  scores,
  skipVotes,
  reactions,
  currentParticipant,
  currentSongIndex,
  sessionStartedAt,
  initialPlaybackTime,
  currentRating,
  hasVoted,
  elapsedTime,
  skipAvailableAfterSeconds,
  onSongEnd,
  onVote,
  onSkipVote,
  onAddReaction,
  onRemoveReaction,
}: PlayingViewProps) {
  const canSkip = elapsedTime >= skipAvailableAfterSeconds;
  const songSkipVotes = skipVotes.filter((v) => v.song_id === currentSong.id);
  const hasSkipVoted = currentParticipant
    ? songSkipVotes.some((v) => v.participant_id === currentParticipant.id)
    : false;
  const skipThreshold = Math.ceil(participants.length * 0.5);

  // Get names of people who voted to skip
  const skipVoterNames = songSkipVotes
    .map(vote => {
      const participant = participants.find(p => p.id === vote.participant_id);
      return participant?.user_name || 'Unknown';
    })
    .filter(Boolean);

  return (
    <div className="space-y-4">
      {/* Skip Vote Button - Only show when time available */}
      {canSkip && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-end">
                <Button
                  variant={hasSkipVoted ? "default" : "outline"}
                  size="sm"
                  onClick={onSkipVote}
                  className="flex items-center gap-2"
                >
                  <SkipForward className="h-4 w-4" />
                  <span>Skip</span>
                  <span className="text-xs opacity-70">
                    ({songSkipVotes.length}/{skipThreshold})
                  </span>
                </Button>
              </div>
            </TooltipTrigger>
            {skipVoterNames.length > 0 && (
              <TooltipContent>
                <div className="text-xs">
                  <p className="font-semibold mb-1">Voted to skip:</p>
                  <ul className="list-disc list-inside">
                    {skipVoterNames.map((name, idx) => (
                      <li key={idx}>{name}</li>
                    ))}
                  </ul>
                </div>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}
      {/* Video Player */}
      <Card className="border-0 p-0">
        <CardContent className="p-0">

          {currentSong.source === 'youtube' && (
            <YouTubePlayerComponent
              key={currentSong.id}
              videoId={currentSong.source_id}
              onEnd={onSongEnd}
              autoplay={true}
              startTime={initialPlaybackTime}
              sessionStartedAt={sessionStartedAt || undefined}
            />
          )}
        </CardContent>
      </Card>

      {/* Progress Bar */}
      {sessionStartedAt && (
        <SongProgressBar
          duration={currentSong.duration}
          startedAt={sessionStartedAt}
        />
      )}

      {/* Song Info & Voting */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">


            <div className="font-semibold truncate">{currentSong.title}</div>
            <div className="text-sm text-muted-foreground truncate">{currentSong.artist}</div>


          </div>
          {/* Reactions */}
          <SongReactions
            songId={currentSong.id}
            reactions={reactions.filter((r) => r.song_id === currentSong.id)}
            currentParticipantId={currentParticipant?.id}
            onAddReaction={(emoji) => onAddReaction(currentSong.id, emoji)}
            onRemoveReaction={(emoji) => onRemoveReaction(currentSong.id, emoji)}
          />
          <VotingStars
            currentRating={currentRating}
            hasVoted={hasVoted}
            onVote={onVote}
          />
        </div>

        

        

        {/* Chat */}
        <ChatMessagesContainer
          songId={currentSong.id}
          participants={participants}
          currentParticipantId={currentParticipant?.id}
        />
      </div>

      {/* Queue */}
      <SongQueueList
        songs={songs}
        participants={participants}
        scores={scores}
        currentSongIndex={currentSongIndex ?? undefined}
        showScores={true}
      />
    </div>
  );
});

export default PlayingView;
