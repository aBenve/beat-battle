'use client';

import { memo } from 'react';
import { Music, Play, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import SongQueueList from '@/components/session/song-queue-list';
import type { Database } from '@/lib/supabase/database.types';

type Song = Database['public']['Tables']['songs']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];

interface WaitingViewProps {
  songs: Song[];
  participants: Participant[];
  isHost: boolean;
  onStartSession: () => void;
  onAddSong: () => void;
}

const WaitingView = memo(function WaitingView({
  songs,
  participants,
  isHost,
  onStartSession,
  onAddSong,
}: WaitingViewProps) {
  // Empty state - encourage adding songs
  if (songs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Music className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-2">Let&apos;s build the playlist!</h3>
                <p className="text-sm text-muted-foreground">
                  Everyone can add songs. The host will shuffle and start when ready.
                </p>
              </div>
              <Button onClick={onAddSong} size="lg" className="w-full">
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Song
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Waiting State with Songs */}
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-4 max-w-md">
          <Music className="h-12 w-12 mx-auto text-primary" />
          <div>
            <p className="text-xl font-semibold">Ready to rock!</p>
            <p className="text-sm text-muted-foreground mt-2">
              {songs.length} {songs.length === 1 ? 'song' : 'songs'} in the queue
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isHost
                ? 'Start when everyone has added their songs'
                : 'Add more songs or wait for the host to start'}
            </p>
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={onAddSong} variant="outline" size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add More
            </Button>
            {isHost && (
              <Button onClick={onStartSession} size="sm">
                <Play className="h-4 w-4 mr-2" />
                Start Session
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Queue */}
      <SongQueueList
        songs={songs}
        participants={participants}
        showScores={false}
      />
    </div>
  );
});

export default WaitingView;
