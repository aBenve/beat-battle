'use client';

import { memo } from 'react';
import { Button } from '@/components/ui/button';
import OnlineUsers from '@/components/session/online-users';
import { Music, Flag, Shuffle, Infinity } from 'lucide-react';
import type { PresenceState } from '@/lib/realtime';

interface SessionHeaderProps {
  sessionName: string;
  sessionCode: string;
  copiedCode: boolean;
  infiniteMode?: boolean;
  onCopyCode: () => void;
  onAddSong: () => void;
  onShuffleQueue?: () => void;
  onToggleInfiniteMode?: () => void;
  onFinishSession?: () => void;
  isHost: boolean;
  isPlaying: boolean;
  onlineUsers: PresenceState[];
  currentUserId?: string;
}

/**
 * SessionHeader - Displays session name, code, online users, and actions
 * Memoized to prevent re-renders when other state changes
 */
const SessionHeader = memo(function SessionHeader({
  sessionName,
  sessionCode,
  copiedCode,
  infiniteMode,
  onCopyCode,
  onAddSong,
  onShuffleQueue,
  onToggleInfiniteMode,
  onFinishSession,
  isHost,
  isPlaying,
  onlineUsers,
  currentUserId,
}: SessionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">{sessionName}</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCopyCode}
          className="text-xs"
        >
          {copiedCode ? 'Copied!' : sessionCode}
        </Button>
        {infiniteMode && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Infinity className="h-3 w-3" />
            <span>Infinite</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <OnlineUsers
          users={onlineUsers}
          currentUserId={currentUserId}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddSong}
        >
          <Music className="h-4 w-4" />
        </Button>
        {isHost && !isPlaying && onShuffleQueue && (
          <Button
            variant="outline"
            size="sm"
            onClick={onShuffleQueue}
          >
            <Shuffle className="h-4 w-4 mr-2" />
            Shuffle
          </Button>
        )}
        {isHost && !isPlaying && onToggleInfiniteMode && (
          <Button
            variant={infiniteMode ? "default" : "outline"}
            size="sm"
            onClick={onToggleInfiniteMode}
          >
            <Infinity className="h-4 w-4 mr-2" />
            Infinite
          </Button>
        )}
        {isHost && isPlaying && onFinishSession && (
          <Button
            variant="destructive"
            size="sm"
            onClick={onFinishSession}
          >
            <Flag className="h-4 w-4 mr-2" />
            Finish
          </Button>
        )}
      </div>
    </div>
  );
});

export default SessionHeader;
