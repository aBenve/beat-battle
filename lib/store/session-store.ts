import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import { SessionRealtime } from '@/lib/realtime';
import type { PresenceState } from '@/lib/realtime';

type Session = Database['public']['Tables']['sessions']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];
type Song = Database['public']['Tables']['songs']['Row'];
type Score = Database['public']['Tables']['scores']['Row'];

interface SessionState {
  // Current session data
  session: Session | null;
  participants: Participant[];
  songs: Song[];
  scores: Score[];
  currentParticipant: Participant | null;

  // Realtime connection (new system!)
  realtime: SessionRealtime | null;
  onlineUsers: PresenceState[];

  // Actions
  setCurrentParticipant: (participant: Participant) => void;
  loadSession: (sessionId: string) => Promise<void>;
  subscribeToSession: (sessionId: string) => Promise<void>;
  unsubscribeFromSession: () => void;
  updateSession: (updates: Partial<Session>) => Promise<void>;
  addSong: (song: Omit<Song, 'id' | 'created_at'>) => Promise<void>;
  removeSong: (songId: string) => Promise<void>;
  reorderSongs: (songs: Song[]) => Promise<void>;
  addScore: (score: Omit<Score, 'id' | 'created_at'>) => Promise<void>;
  forcePlaySong: (songId: string, participantId: string) => Promise<void>;
  nextSong: () => Promise<void>;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  participants: [],
  songs: [],
  scores: [],
  currentParticipant: null,
  realtime: null,
  onlineUsers: [],

  setCurrentParticipant: (participant) => {
    set({ currentParticipant: participant });
  },

  loadSession: async (sessionId: string) => {
    try {
      // Load session
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Load participants
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .select('*')
        .eq('session_id', sessionId)
        .order('joined_at', { ascending: true });

      if (participantsError) throw participantsError;

      // Load songs
      const { data: songs, error: songsError } = await supabase
        .from('songs')
        .select('*')
        .eq('session_id', sessionId)
        .order('position', { ascending: true });

      if (songsError) throw songsError;

      // Load scores
      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('*')
        .eq('session_id', sessionId);

      if (scoresError) throw scoresError;

      set({
        session,
        participants: participants || [],
        songs: songs || [],
        scores: scores || [],
      });
    } catch (error) {
      console.error('Error loading session:', error);
      throw error;
    }
  },

  subscribeToSession: async (sessionId: string) => {
    const { currentParticipant } = get();

    // Create and connect the realtime system
    const realtime = new SessionRealtime(sessionId);

    try {
      await realtime.connect();
      console.log('[Store] Connected to realtime');

      // === BROADCAST LISTENERS (Instant updates) ===

      // Listen to live score updates via broadcast
      realtime.broadcast.on('score_added', (data) => {
        console.log('[Store] Score broadcast received:', data);
        // Optimistically add score to local state (already done in addScore)
        // This is for OTHER users to see the score instantly
        const { scores } = get();
        const existingScore = scores.find(
          (s) => s.song_id === data.song_id && s.participant_id === data.participant_id
        );

        if (!existingScore) {
          // Add a temporary score object
          const newScore: Score = {
            id: data.score_id,
            session_id: sessionId,
            song_id: data.song_id,
            participant_id: data.participant_id,
            rating: data.rating,
            created_at: new Date(data.timestamp).toISOString(),
          };
          set({ scores: [...scores, newScore] });
        }
      });

      // === PRESENCE LISTENERS (Who's online) ===

      realtime.presence.onChange((payload) => {
        console.log('[Store] Presence changed:', payload.event);

        if (payload.event === 'sync') {
          // Full sync of all online users
          const users = realtime.presence.getUsers();
          set({ onlineUsers: users });
          console.log('[Store] Online users synced:', users.length);
        } else if (payload.event === 'join') {
          // Someone joined
          const users = realtime.presence.getUsers();
          set({ onlineUsers: users });
          console.log('[Store] User joined:', payload.newPresences?.[0]?.user_name);
        } else if (payload.event === 'leave') {
          // Someone left
          const users = realtime.presence.getUsers();
          set({ onlineUsers: users });
          console.log('[Store] User left:', payload.leftPresences?.[0]?.user_name);
        }
      });

      // Track own presence
      if (currentParticipant) {
        await realtime.trackPresence({
          user_id: currentParticipant.id,
          user_name: currentParticipant.user_name,
          is_host: currentParticipant.is_host,
          is_listening: true,
          joined_at: new Date().toISOString(),
          last_active: Date.now(),
        });
        console.log('[Store] Presence tracked for:', currentParticipant.user_name);
      }

      // === POSTGRES LISTENERS (Database changes) ===

      // Listen to session changes (status, current song, etc.)
      realtime.postgres.onSession(sessionId, (change) => {
        console.log('[Store] Session changed:', change.eventType);
        if (change.eventType === 'UPDATE' && change.new) {
          set({ session: change.new });
        }
      });

      // Listen to participant changes (joins/leaves)
      realtime.postgres.onParticipants(sessionId, async (change) => {
        console.log('[Store] Participants changed:', change.eventType);
        // Reload all participants to keep order consistent
        const { data } = await supabase
          .from('participants')
          .select('*')
          .eq('session_id', sessionId)
          .order('joined_at', { ascending: true });

        if (data) set({ participants: data });
      });

      // Listen to song changes (add/remove/reorder)
      realtime.postgres.onSongs(sessionId, async (change) => {
        console.log('[Store] Songs changed:', change.eventType);
        // Reload all songs to maintain proper order
        const { data } = await supabase
          .from('songs')
          .select('*')
          .eq('session_id', sessionId)
          .order('position', { ascending: true });

        if (data) set({ songs: data });
      });

      // Listen to score changes (backup for broadcasts)
      // This ensures scores are persisted even if broadcast fails
      realtime.postgres.onScores(sessionId, async (change) => {
        console.log('[Store] Scores changed in DB:', change.eventType);
        // Only reload if we don't already have this score (broadcast missed)
        const { scores } = get();

        if (change.eventType === 'INSERT' && change.new) {
          const existingScore = scores.find((s) => s.id === change.new!.id);
          if (!existingScore) {
            set({ scores: [...scores, change.new] });
          }
        }
      });

      set({ realtime });
      console.log('[Store] Realtime subscriptions set up successfully');
    } catch (error) {
      console.error('[Store] Error setting up realtime:', error);
      throw error;
    }
  },

  unsubscribeFromSession: async () => {
    const { realtime } = get();
    if (realtime) {
      await realtime.disconnect();
      set({ realtime: null, onlineUsers: [] });
    }
  },

  updateSession: async (updates) => {
    const { session } = get();
    if (!session) return;

    // Always update last_activity_at when session is updated
    const updatesWithActivity = {
      ...updates,
      last_activity_at: new Date().toISOString(),
    };

    const { error, data } = await supabase
      .from('sessions')
      .update(updatesWithActivity)
      .eq('id', session.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating session:', error);
      throw error;
    }

    // Update local state immediately
    if (data) {
      console.log('Session updated locally:', data);
      set({ session: data });
    }
  },

  addSong: async (song) => {
    const { error } = await supabase.from('songs').insert([song]);

    if (error) {
      console.error('Error adding song:', error);
      throw error;
    }

    // Manually reload songs to update UI immediately
    // (in case realtime subscription is slow or not working)
    const { session } = get();
    if (session) {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('session_id', session.id)
        .order('position', { ascending: true });

      if (data) {
        console.log('Manually reloaded songs after insert:', data);
        set({ songs: data });
      }
    }
  },

  removeSong: async (songId: string) => {
    const { error } = await supabase.from('songs').delete().eq('id', songId);

    if (error) {
      console.error('Error removing song:', error);
      throw error;
    }

    // Manually reload songs
    const { session } = get();
    if (session) {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('session_id', session.id)
        .order('position', { ascending: true });

      if (data) {
        set({ songs: data });
      }
    }
  },

  reorderSongs: async (songs: Song[]) => {
    // Update positions for all songs
    const updates = songs.map((song, index) => ({
      id: song.id,
      position: index,
    }));

    // Use Promise.all to update all positions
    const promises = updates.map((update) =>
      supabase
        .from('songs')
        .update({ position: update.position })
        .eq('id', update.id)
    );

    const results = await Promise.all(promises);

    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      console.error('Error reordering songs:', errors);
      throw new Error('Failed to reorder songs');
    }

    // Update local state
    set({ songs });
  },

  addScore: async (score) => {
    const { realtime, currentParticipant, scores } = get();

    const { error, data } = await supabase
      .from('scores')
      .insert([score])
      .select()
      .single();

    if (error) {
      console.error('Error adding score:', error);
      throw error;
    }

    // Optimistically update local state for instant feedback
    if (data) {
      set({ scores: [...scores, data] });

      // Broadcast the score to all other users for INSTANT updates!
      if (realtime && currentParticipant) {
        await realtime.broadcast.send('score_added', {
          score_id: data.id,
          song_id: data.song_id,
          participant_id: data.participant_id,
          participant_name: currentParticipant.user_name,
          rating: data.rating,
          timestamp: Date.now(),
        });
        console.log('[Store] Score broadcasted to all users');
      }
    }
  },

  forcePlaySong: async (songId: string, participantId: string) => {
    const { session, songs } = get();
    if (!session) return;

    // Find the song position
    const song = songs.find((s) => s.id === songId);
    if (!song) return;

    // Record the force play
    await supabase.from('force_plays').insert([
      {
        session_id: session.id,
        participant_id: participantId,
        song_id: songId,
      },
    ]);

    // Update current song index to the forced song
    await get().updateSession({
      current_song_index: song.position,
      current_song_started_at: new Date().toISOString(),
    });
  },

  nextSong: async () => {
    const { session, songs } = get();
    if (!session) return;

    const nextIndex = session.current_song_index + 1;

    if (nextIndex >= songs.length) {
      // End of session
      await get().updateSession({ status: 'finished' });
    } else {
      await get().updateSession({
        current_song_index: nextIndex,
        current_song_started_at: new Date().toISOString(),
      });
    }
  },

  reset: () => {
    get().unsubscribeFromSession();
    set({
      session: null,
      participants: [],
      songs: [],
      scores: [],
      currentParticipant: null,
      realtime: null,
      onlineUsers: [],
    });
  },
}));
