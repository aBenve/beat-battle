'use client';

import { memo } from 'react';
import { Star } from 'lucide-react';
import type { Database } from '@/lib/supabase/database.types';

type Song = Database['public']['Tables']['songs']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];
type Score = Database['public']['Tables']['scores']['Row'];

interface SongQueueListProps {
  songs: Song[];
  participants: Participant[];
  scores?: Score[];
  currentSongIndex?: number;
  showScores?: boolean;
}

/**
 * SongQueueList - Compact view showing only current and next song
 * Shows a hint about the next song with who added it
 */
const SongQueueList = memo(function SongQueueList({
  songs,
  participants,
  scores = [],
  currentSongIndex,
  showScores = false,
}: SongQueueListProps) {
  if (songs.length === 0) {
    return null;
  }

  // Show only current and next song during playback
  if (currentSongIndex !== undefined) {
    const nextSong = songs[currentSongIndex + 1];

    return (
      <div className="mt-6">
        {nextSong && (
          <div className="text-center">
            <div className="text-xs text-muted-foreground mb-2">Up Next</div>
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="font-medium truncate max-w-[200px]">{nextSong.title}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground text-xs">
                {participants.find((p) => p.id === nextSong.added_by)?.user_name || 'Unknown'}
              </span>
            </div>
          </div>
        )}
        {!nextSong && (
          <div className="text-center text-xs text-muted-foreground">
            Last song in queue
          </div>
        )}
      </div>
    );
  }

  // Show full queue in waiting view
  return (
    <div className="mt-8">
      <div className="text-xs text-muted-foreground mb-3 uppercase tracking-wider">
        Queue ({songs.length} songs)
      </div>
      <div className="space-y-2">
        {songs.map((song, index) => {
          const addedBy = participants.find((p) => p.id === song.added_by);

          // Get all scores for this song
          const songScores = scores.filter((s) => s.song_id === song.id);
          const avgScore = songScores.length > 0
            ? (songScores.reduce((sum, s) => sum + s.rating, 0) / songScores.length).toFixed(1)
            : null;

          return (
            <div
              key={song.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-card"
            >
              <div className="text-sm font-semibold w-6">{index + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate text-sm">{song.title}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {song.artist} · {addedBy?.user_name || 'Unknown'}
                </div>
              </div>
              {showScores && avgScore && (
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
  );
});

export default SongQueueList;
