'use client';

import { Trophy, Star, Plus, LogIn } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import type { Database } from '@/lib/supabase/database.types';

type Session = Database['public']['Tables']['sessions']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];
type Song = Database['public']['Tables']['songs']['Row'];
type Score = Database['public']['Tables']['scores']['Row'];

interface SessionResultsProps {
  session: Session;
  participants: Participant[];
  songs: Song[];
  scores: Score[];
}

interface ParticipantStats {
  participant: Participant;
  songsAdded: number;
  averageScore: number;
  totalVotes: number;
  bestSong?: { song: Song; avgScore: number };
}

export default function SessionResults({
  session,
  participants,
  songs,
  scores,
}: SessionResultsProps) {
  console.log('[SessionResults] Rendering with participants:', participants.length, participants);
  console.log('[SessionResults] Songs:', songs.length, 'Scores:', scores.length);

  // Calculate participant statistics
  const participantStats: ParticipantStats[] = participants.map((participant) => {
    const participantSongs = songs.filter((s) => s.added_by === participant.id);
    const songsAdded = participantSongs.length;

    // Get all scores for songs added by this participant (excluding self-votes)
    const songScores = scores.filter(
      (score) =>
        participantSongs.some((s) => s.id === score.song_id) &&
        score.participant_id !== participant.id
    );

    const totalVotes = songScores.length;
    const averageScore =
      totalVotes > 0
        ? songScores.reduce((sum, s) => sum + s.rating, 0) / totalVotes
        : 0;

    // Find best song
    let bestSong: { song: Song; avgScore: number } | undefined;
    if (participantSongs.length > 0) {
      const songAvgs = participantSongs.map((song) => {
        const songScoresOnly = songScores.filter((s) => s.song_id === song.id);
        const avg =
          songScoresOnly.length > 0
            ? songScoresOnly.reduce((sum, s) => sum + s.rating, 0) /
              songScoresOnly.length
            : 0;
        return { song, avgScore: avg };
      });
      bestSong = songAvgs.sort((a, b) => b.avgScore - a.avgScore)[0];
    }

    return {
      participant,
      songsAdded,
      averageScore,
      totalVotes,
      bestSong,
    };
  });

  // Sort by average score (leaderboard)
  const leaderboard = [...participantStats].sort(
    (a, b) => b.averageScore - a.averageScore
  );

  // Calculate session statistics
  const totalMinutes = songs.reduce((sum, song) => sum + song.duration, 0) / 60;
  const mostLikedSong = songs
    .map((song) => {
      const songScores = scores.filter((s) => s.song_id === song.id);
      const avg =
        songScores.length > 0
          ? songScores.reduce((sum, s) => sum + s.rating, 0) / songScores.length
          : 0;
      return { song, avgScore: avg, voteCount: songScores.length };
    })
    .sort((a, b) => b.avgScore - a.avgScore)[0];

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Trophy className="h-8 w-8" />
            <div>
              <h1 className="text-3xl font-bold">Session Complete</h1>
              <p className="text-sm text-muted-foreground">{session.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/create">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Session
              </Button>
            </Link>
            <Link href="/join">
              <Button variant="outline" size="sm">
                <LogIn className="h-4 w-4 mr-2" />
                Join Session
              </Button>
            </Link>
          </div>
        </div>

        {/* Leaderboard */}
        <div>
          <div className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
            Leaderboard
          </div>
          <div className="space-y-3">
            {leaderboard.map((stats, index) => {
              const place = index + 1;

              return (
                <div
                  key={stats.participant.id}
                  className={`flex items-center gap-4 p-4 rounded-lg ${
                    place === 1
                      ? 'bg-secondary border border-primary/20'
                      : 'bg-card'
                  }`}
                >
                  {/* Place */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground font-bold">
                    {place}
                  </div>

                  {/* Avatar & Name */}
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {stats.participant.user_name?.charAt(0).toUpperCase() || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">
                      {stats.participant.user_name || 'Unknown'}
                      {stats.participant.is_host && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          Host
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {stats.songsAdded} songs · {stats.totalVotes} votes · {stats.participant.karma || 0} karma
                    </div>
                    {stats.bestSong && (
                      <div className="text-xs text-muted-foreground truncate mt-1">
                        Best: {stats.bestSong.song.title} ({stats.bestSong.avgScore.toFixed(1)} ⭐)
                      </div>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {stats.averageScore.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Star className="h-3 w-3 fill-white text-white" />
                      avg
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {stats.participant.karma || 0} pts
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card p-4 rounded-lg">
            <div className="text-2xl font-bold">{songs.length}</div>
            <div className="text-xs text-muted-foreground">Songs Played</div>
          </div>

          <div className="bg-card p-4 rounded-lg">
            <div className="text-2xl font-bold">{Math.round(totalMinutes)}</div>
            <div className="text-xs text-muted-foreground">Minutes</div>
          </div>

          <div className="bg-card p-4 rounded-lg">
            <div className="text-2xl font-bold">{participants.length}</div>
            <div className="text-xs text-muted-foreground">Participants</div>
          </div>

          <div className="bg-card p-4 rounded-lg">
            <div className="text-2xl font-bold">{scores.length}</div>
            <div className="text-xs text-muted-foreground">Total Votes</div>
          </div>
        </div>

        {/* Most Liked Song */}
        {mostLikedSong && (
          <div>
            <div className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
              Most Liked Song
            </div>
            <div className="bg-card p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">
                    {mostLikedSong.song.title}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {mostLikedSong.song.artist}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Added by{' '}
                    {
                      participants.find(
                        (p) => p.id === mostLikedSong.song.added_by
                      )?.user_name
                    }
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  <Star className="h-4 w-4 fill-white text-white" />
                  <span className="text-lg font-bold">
                    {mostLikedSong.avgScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({mostLikedSong.voteCount})
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
