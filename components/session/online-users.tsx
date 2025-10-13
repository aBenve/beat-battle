'use client';

import { memo } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { PresenceState } from '@/lib/realtime';
import { Crown, Radio } from 'lucide-react';

interface OnlineUsersProps {
  users: PresenceState[];
  currentUserId?: string;
}

/**
 * OnlineUsers component - Shows live presence of users in the session
 *
 * Features:
 * - Real-time list of who's online (via Presence)
 * - Shows host badge
 * - Highlights current user
 * - Shows listening status
 */
const OnlineUsers = memo(function OnlineUsers({
  users,
  currentUserId,
}: OnlineUsersProps) {
  if (users.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {users.map((user) => {
        const isCurrentUser = user.user_id === currentUserId;
        const initials = user.user_name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        return (
          <div
            key={user.user_id}
            className="flex items-center gap-1.5 group relative"
            title={user.user_name}
          >
            {/* Avatar with online indicator */}
            <div className="relative">
              <Avatar className={`h-8 w-8 ${isCurrentUser ? 'ring-2 ring-primary' : ''}`}>
                <AvatarFallback className="text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Online/Listening indicator */}
              {user.is_listening && (
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background flex items-center justify-center">
                  <Radio className="h-1.5 w-1.5 text-white animate-pulse" />
                </div>
              )}
            </div>

            {/* Host badge */}
            {user.is_host && (
              <Crown className="h-3.5 w-3.5 text-yellow-500" />
            )}

            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
              {user.user_name}
              {isCurrentUser && ' (You)'}
              {user.is_host && ' • Host'}
            </div>
          </div>
        );
      })}

      {/* User count badge */}
      <Badge variant="secondary" className="h-8 px-2 text-xs">
        {users.length} online
      </Badge>
    </div>
  );
});

export default OnlineUsers;
