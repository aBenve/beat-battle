'use client';

import { memo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Smile } from 'lucide-react';

interface SongReactionsProps {
  songId: string;
  reactions: Array<{ emoji: string; participant_id: string }>;
  currentParticipantId?: string;
  onAddReaction: (emoji: string) => Promise<void>;
  onRemoveReaction: (emoji: string) => Promise<void>;
}

const EMOJI_OPTIONS = ['🔥', '❤️', '👏', '🎵', '🎉', '😍'];

const SongReactions = memo(function SongReactions({
  songId,
  reactions,
  currentParticipantId,
  onAddReaction,
  onRemoveReaction,
}: SongReactionsProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Count reactions by emoji
  const reactionCounts = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Check if current user has reacted with each emoji
  const userReactions = reactions
    .filter((r) => r.participant_id === currentParticipantId)
    .map((r) => r.emoji);

  const handleEmojiClick = async (emoji: string) => {
    if (userReactions.includes(emoji)) {
      await onRemoveReaction(emoji);
    } else {
      await onAddReaction(emoji);
    }
    setShowPicker(false);
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Reaction counts */}
      <div className="flex items-center gap-1">
        {Object.entries(reactionCounts).map(([emoji, count]) => {
          const hasReacted = userReactions.includes(emoji);
          return (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className={`px-2 py-1 rounded-full text-sm transition-all ${
                hasReacted
                  ? 'bg-primary/20 border border-primary scale-110'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {emoji} {count}
            </button>
          );
        })}
      </div>

      {/* Add reaction button */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPicker(!showPicker)}
          className="h-8 w-8 p-0"
        >
          <Smile className="h-4 w-4" />
        </Button>

        {/* Emoji picker */}
        {showPicker && (
          <>
            {/* Backdrop to close picker */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowPicker(false)}
            />
            {/* Picker */}
            <div className="absolute bottom-full right-0 mb-2 p-2 bg-popover border rounded-lg shadow-lg z-20 flex gap-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiClick(emoji)}
                  className={`w-10 h-10 rounded hover:bg-muted transition-all text-2xl ${
                    userReactions.includes(emoji) ? 'bg-primary/20 scale-110' : ''
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default SongReactions;
