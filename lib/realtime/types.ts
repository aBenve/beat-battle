import type { Database } from '@/lib/supabase/database.types';

type Session = Database['public']['Tables']['sessions']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];
type Song = Database['public']['Tables']['songs']['Row'];
type Score = Database['public']['Tables']['scores']['Row'];

// Broadcast Events - Ephemeral messages sent between clients
export interface BroadcastEvents {
  // Score updates - instant feedback when someone votes
  score_added: {
    score_id: string;
    song_id: string;
    participant_id: string;
    participant_name: string;
    rating: number;
    timestamp: number;
  };

  // Chat messages (future feature)
  chat_message: {
    id: string;
    participant_id: string;
    participant_name: string;
    message: string;
    timestamp: number;
  };

  // Typing indicator (future feature)
  typing: {
    participant_id: string;
    participant_name: string;
    isTyping: boolean;
  };

  // Reaction to current song (future feature)
  song_reaction: {
    participant_id: string;
    participant_name: string;
    emoji: string;
    timestamp: number;
  };
}

// Presence State - Track who's online and their current state
export interface PresenceState {
  user_id: string;
  user_name: string;
  joined_at: string;
  is_host: boolean;
  // Custom state you can add
  is_listening: boolean;
  last_active: number;
  // Can add more: currentSong, isVoting, etc.
}

// Presence Events
export type PresenceEvent = 'sync' | 'join' | 'leave';

export interface PresencePayload {
  event: PresenceEvent;
  key?: string;
  newPresences?: PresenceState[];
  leftPresences?: PresenceState[];
  currentPresences?: Record<string, PresenceState[]>;
}

// Realtime callbacks
export type BroadcastCallback<T extends keyof BroadcastEvents> = (
  payload: BroadcastEvents[T]
) => void;

export type PresenceCallback = (payload: PresencePayload) => void;

// Realtime channel status
export type RealtimeStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'subscribed'
  | 'closed'
  | 'error';
