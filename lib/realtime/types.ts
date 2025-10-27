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

  // Song added to queue - instant notification when someone adds a song
  song_added: {
    song_id: string;
    title: string;
    artist: string;
    added_by: string;
    timestamp: number;
  };

  // Chat messages - per-song chat
  chat_message: {
    id: string;
    song_id: string;
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

  // Song changed event - notifies all clients when host changes song
  song_changed: {
    session_id: string;
    song_id: string;
    song_index: number;
    started_at: string; // ISO timestamp
    host_id: string;
    timestamp: number;
  };

  // Session ended - notifies all clients when host ends the session
  session_ended: {
    session_id: string;
    host_id: string;
    timestamp: number;
  };

  // Session started - notifies all clients when host starts the session
  session_started: {
    session_id: string;
    host_id: string;
    first_song_id: string;
    timestamp: number;
  };

  // Skip vote added - notifies all clients when someone votes to skip
  skip_vote_added: {
    skip_vote_id: string;
    song_id: string;
    participant_id: string;
    participant_name: string;
    timestamp: number;
  };

  // Skip vote removed - notifies all clients when someone removes their skip vote
  skip_vote_removed: {
    skip_vote_id: string;
    song_id: string;
    participant_id: string;
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
