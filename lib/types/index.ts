export interface User {
  id: string;
  name: string;
  avatar?: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  albumArt?: string;
  duration: number;
  source: 'spotify' | 'youtube';
  sourceId: string;
  addedBy: string;
}

export interface Score {
  userId: string;
  songId: string;
  rating: number; // 1-5 stars
}

export interface Session {
  id: string;
  name: string;
  hostId: string;
  participants: User[];
  playlist: Song[];
  currentSongIndex: number;
  currentSongStartTime?: number;
  scores: Score[];
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  settings: SessionSettings;
}

export interface SessionSettings {
  maxParticipants: number;
  allowForcePlay: boolean;
  forcePlayCooldown: number; // seconds
  votingDuration: number; // seconds
  songsPerParticipant: number;
}

export interface ForcePlayAction {
  userId: string;
  songId: string;
  timestamp: number;
}

export interface SessionState {
  session: Session | null;
  currentUser: User | null;
  isHost: boolean;
}
