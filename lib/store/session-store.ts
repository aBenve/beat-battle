import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';
import { SessionRealtime } from '@/lib/realtime';
import type { PresenceState } from '@/lib/realtime';

type Session = Database['public']['Tables']['sessions']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];
type Song = Database['public']['Tables']['songs']['Row'];
type Score = Database['public']['Tables']['scores']['Row'];
type SkipVote = Database['public']['Tables']['skip_votes']['Row'];
type Reaction = Database['public']['Tables']['reactions']['Row'];
type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];
type KarmaHistory = Database['public']['Tables']['karma_history']['Row'];

interface SessionState {
  // Current session data
  session: Session | null;
  participants: Participant[];
  songs: Song[];
  scores: Score[];
  skipVotes: SkipVote[];
  reactions: Reaction[];
  chatMessages: ChatMessage[];
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
  toggleInfiniteMode: () => Promise<void>;
  addSong: (song: Omit<Song, 'id' | 'created_at'>) => Promise<void>;
  removeSong: (songId: string) => Promise<void>;
  reorderSongs: (songs: Song[]) => Promise<void>;
  shuffleQueue: () => Promise<void>;
  addScore: (score: Omit<Score, 'id' | 'created_at'>) => Promise<void>;
  addSkipVote: (songId: string) => Promise<void>;
  removeSkipVote: (songId: string) => Promise<void>;
  addReaction: (songId: string, emoji: string) => Promise<void>;
  removeReaction: (songId: string, emoji: string) => Promise<void>;
  loadChatMessages: (songId: string) => Promise<void>;
  sendChatMessage: (songId: string, message: string) => Promise<void>;
  forcePlaySong: (songId: string, participantId: string) => Promise<void>;
  nextSong: () => Promise<void>;
  awardKarma: (participantId: string, amount: number, reason: string) => Promise<void>;
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  participants: [],
  songs: [],
  scores: [],
  skipVotes: [],
  reactions: [],
  chatMessages: [],
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

      // Load skip votes
      const { data: skipVotes, error: skipVotesError } = await supabase
        .from('skip_votes')
        .select('*')
        .eq('session_id', sessionId);

      if (skipVotesError) throw skipVotesError;

      // Load reactions
      const { data: reactions, error: reactionsError } = await supabase
        .from('reactions')
        .select('*')
        .eq('session_id', sessionId);

      if (reactionsError) throw reactionsError;

      set({
        session,
        participants: participants || [],
        songs: songs || [],
        scores: scores || [],
        skipVotes: skipVotes || [],
        reactions: reactions || [],
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

      // Listen to song additions via broadcast
      realtime.broadcast.on('song_added', async (data) => {
        console.log('[Store] Song added broadcast received:', data);

        // Only reload if the song doesn't already exist in our state
        // (to avoid re-rendering when we added the song ourselves)
        const { songs } = get();
        const songExists = songs.some(s => s.id === data.song_id);

        if (!songExists) {
          // Reload songs to get the full updated list
          const { data: allSongs } = await supabase
            .from('songs')
            .select('*')
            .eq('session_id', sessionId)
            .order('position', { ascending: true });

          if (allSongs) {
            console.log('[Store] Reloaded songs from broadcast:', allSongs.length);
            set({ songs: allSongs });
          }
        } else {
          console.log('[Store] Song already in state, skipping reload');
        }
      });

      // Listen to song changes (when host skips or changes song)
      realtime.broadcast.on('song_changed', async (data) => {
        console.log('[Store] Song changed broadcast received:', data);

        // Check if our local state already matches the change
        const { session } = get();
        if (session?.current_song_index === data.song_index) {
          console.log('[Store] Session already up to date, skipping reload');
          return;
        }

        // Reload session to get updated current_song_index and started_at
        const { data: sessionData, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionData && !error) {
          console.log('[Store] Session reloaded from song change broadcast');
          set({ session: sessionData });

          // Clear skip votes for the new song (they're song-specific)
          set({ skipVotes: [] });

          // Reload skip votes for the new song
          const { data: newSkipVotes } = await supabase
            .from('skip_votes')
            .select('*')
            .eq('session_id', sessionId);

          if (newSkipVotes) {
            set({ skipVotes: newSkipVotes });
          }
        }
      });

      // Listen to session start
      realtime.broadcast.on('session_started', async (data) => {
        console.log('[Store] Session started broadcast received:', data);

        // Check if session is already playing
        const { session } = get();
        if (session?.status === 'playing') {
          console.log('[Store] Session already playing, skipping reload');
          return;
        }

        // Reload session to get updated status and current song
        const { data: sessionData, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionData && !error) {
          console.log('[Store] Session reloaded from session start broadcast');
          set({ session: sessionData });
        }
      });

      // Listen to session end
      realtime.broadcast.on('session_ended', async (data) => {
        console.log('[Store] Session ended broadcast received:', data);

        // Check if session is already finished
        const { session } = get();
        if (session?.status === 'finished') {
          console.log('[Store] Session already finished, skipping reload');
          return;
        }

        // Reload session to show results screen
        const { data: sessionData, error } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionData && !error) {
          console.log('[Store] Session reloaded from session end broadcast');
          set({ session: sessionData });
        }
      });

      // Listen to reactions
      realtime.broadcast.on('song_reaction', async (data) => {
        console.log('[Store] Reaction broadcast received:', data);
        // Reload reactions to get the updated list
        const { data: allReactions } = await supabase
          .from('reactions')
          .select('*')
          .eq('session_id', sessionId);

        if (allReactions) {
          console.log('[Store] Reloaded reactions from broadcast:', allReactions.length);
          set({ reactions: allReactions });
        }
      });

      // Listen to chat messages
      realtime.broadcast.on('chat_message', async (data) => {
        console.log('[Store] Chat message broadcast received:', data);
        // Reload chat messages for this song
        const { data: allMessages } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .eq('song_id', data.song_id)
          .order('created_at', { ascending: true });

        if (allMessages) {
          console.log('[Store] Reloaded chat messages from broadcast:', allMessages.length);
          set({ chatMessages: allMessages });
        }
      });

      // Listen to skip vote additions
      realtime.broadcast.on('skip_vote_added', async (data) => {
        console.log('[Store] Skip vote added broadcast received:', data);
        // Reload skip votes
        const { data: allSkipVotes } = await supabase
          .from('skip_votes')
          .select('*')
          .eq('session_id', sessionId);

        if (allSkipVotes) {
          console.log('[Store] Reloaded skip votes from broadcast:', allSkipVotes.length);
          set({ skipVotes: allSkipVotes });
        }
      });

      // Listen to skip vote removals
      realtime.broadcast.on('skip_vote_removed', async (data) => {
        console.log('[Store] Skip vote removed broadcast received:', data);
        // Reload skip votes
        const { data: allSkipVotes } = await supabase
          .from('skip_votes')
          .select('*')
          .eq('session_id', sessionId);

        if (allSkipVotes) {
          console.log('[Store] Reloaded skip votes from broadcast:', allSkipVotes.length);
          set({ skipVotes: allSkipVotes });
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
          user_name: currentParticipant.user_name || 'Unknown',
          is_host: currentParticipant.is_host || false,
          is_listening: true,
          joined_at: new Date().toISOString(),
          last_active: Date.now(),
        });
        console.log('[Store] Presence tracked for:', currentParticipant.user_name || 'Unknown');
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

      // Listen to skip vote changes
      realtime.postgres.onSkipVotes(sessionId, async (change) => {
        console.log('[Store] Skip votes changed:', change.eventType);
        // Reload skip votes for the current song
        const { data } = await supabase
          .from('skip_votes')
          .select('*')
          .eq('session_id', sessionId);

        if (data) set({ skipVotes: data });
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
    const { session, realtime } = get();
    if (!session) return;

    // Always update last_activity_at when session is updated
    const updatesWithActivity = {
      ...updates,
      last_activity_at: new Date().toISOString(),
    };

    const { error, data } = await supabase
      .from('sessions')
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Supabase types issue
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
      console.log('[Store] Session updated locally:', data);
      set({ session: data });

      if (realtime) {
        // If session started, broadcast to all users
        if (updates.status === 'playing' && session.status === 'waiting') {
          const { songs } = get();
          const firstSong = songs[0];
          if (firstSong) {
            await realtime.broadcast.send('session_started', {
              session_id: session.id,
              host_id: session.host_id,
              first_song_id: firstSong.id,
              timestamp: Date.now(),
            });
            console.log('[Store] Session start broadcasted to all users');
          }
        }

        // If session ended, broadcast to all users and reload all data
        if (updates.status === 'finished') {
          // Reload participants, songs, and scores to ensure final results are accurate
          const { data: participants } = await supabase
            .from('participants')
            .select('*')
            .eq('session_id', session.id)
            .order('joined_at', { ascending: true });

          const { data: songs } = await supabase
            .from('songs')
            .select('*')
            .eq('session_id', session.id)
            .order('position', { ascending: true });

          const { data: scores } = await supabase
            .from('scores')
            .select('*')
            .eq('session_id', session.id);

          console.log('[Store] Reloaded final data - Participants:', participants?.length, 'Songs:', songs?.length, 'Scores:', scores?.length);

          set({
            participants: participants || [],
            songs: songs || [],
            scores: scores || [],
          });

          await realtime.broadcast.send('session_ended', {
            session_id: session.id,
            host_id: session.host_id,
            timestamp: Date.now(),
          });
          console.log('[Store] Session end broadcasted to all users');
        }

        // If song changed, broadcast to all users for instant sync
        if (updates.current_song_index !== undefined && updates.current_song_index !== null) {
          const { songs } = get();
          const currentSong = songs[updates.current_song_index];
          if (currentSong) {
            await realtime.broadcast.send('song_changed', {
              session_id: session.id,
              song_id: currentSong.id,
              song_index: updates.current_song_index,
              started_at: updates.current_song_started_at || new Date().toISOString(),
              host_id: session.host_id,
              timestamp: Date.now(),
            });
            console.log('[Store] Song change broadcasted to all users');
          }
        }
      }
    }
  },

  toggleInfiniteMode: async () => {
    const { session } = get();
    if (!session) return;

    const newInfiniteMode = !session.infinite_mode;

    const { error, data } = await supabase
      .from('sessions')
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Supabase types issue
      .update({ infinite_mode: newInfiniteMode })
      .eq('id', session.id)
      .select()
      .single();

    if (error) {
      console.error('Error toggling infinite mode:', error);
      throw error;
    }

    if (data) {
      console.log('[Store] Infinite mode toggled:', newInfiniteMode);
      set({ session: data });
    }
  },

  addSong: async (song) => {
    const { realtime, currentParticipant, awardKarma } = get();

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Supabase types issue
    const { error, data } = await supabase.from('songs').insert([song]).select().single();

    if (error) {
      console.error('Error adding song:', error);
      throw error;
    }

    // Award karma for adding a song
    if (song.added_by) {
      await awardKarma(song.added_by, 2, `Added song "${song.title}"`);
    }

    // Manually reload songs to update UI immediately
    // (in case realtime subscription is slow or not working)
    const { session } = get();
    if (session) {
      const { data: allSongs } = await supabase
        .from('songs')
        .select('*')
        .eq('session_id', session.id)
        .order('position', { ascending: true });

      if (allSongs) {
        console.log('[Store] Manually reloaded songs after insert:', allSongs.length);
        set({ songs: allSongs });

        // Broadcast song addition to all users for INSTANT updates!
        if (realtime && currentParticipant && data) {
          await realtime.broadcast.send('song_added', {
            song_id: data.id,
            title: data.title,
            artist: data.artist,
            added_by: currentParticipant.user_name || 'Unknown',
            timestamp: Date.now(),
          });
          console.log('[Store] Song addition broadcasted to all users');
        }
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
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore - Supabase types issue
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

  shuffleQueue: async () => {
    const { session, songs } = get();
    if (!session) return;

    // Don't shuffle if session is playing
    if (session.status === 'playing') {
      console.warn('Cannot shuffle queue while session is playing');
      return;
    }

    // Fisher-Yates shuffle algorithm
    const shuffled = [...songs];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Use reorderSongs to update positions
    const reorderSongs = get().reorderSongs;
    await reorderSongs(shuffled);

    console.log('[Store] Queue shuffled');
  },

  addScore: async (score) => {
    const { realtime, currentParticipant, scores, songs, awardKarma } = get();

    const { error, data } = await supabase
      .from('scores')
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Supabase types issue
      .insert([score])
      .select()
      .single();

    if (error) {
      console.error('Error adding score:', error);
      throw error;
    }

    // Type assertion for Supabase return data
    const scoreData = data as { id: string; session_id: string; song_id: string; participant_id: string; rating: number; created_at: string };

    // Optimistically update local state for instant feedback
    if (scoreData) {
      set({ scores: [...scores, scoreData] });

      // Award karma for voting
      await awardKarma(scoreData.participant_id, 1, 'Voted on a song');

      // Award bonus karma to song creator if they got a high rating (4-5 stars)
      if (scoreData.rating >= 4) {
        const song = songs.find(s => s.id === scoreData.song_id);
        if (song && song.added_by !== scoreData.participant_id) {
          const karmaBonus = scoreData.rating === 5 ? 3 : 2;
          await awardKarma(song.added_by, karmaBonus, `Song "${song.title}" received ${scoreData.rating} stars`);
        }
      }

      // Broadcast the score to all other users for INSTANT updates!
      if (realtime && currentParticipant) {
        await realtime.broadcast.send('score_added', {
          score_id: scoreData.id,
          song_id: scoreData.song_id,
          participant_id: scoreData.participant_id,
          participant_name: currentParticipant.user_name || 'Unknown',
          rating: scoreData.rating,
          timestamp: Date.now(),
        });
        console.log('[Store] Score broadcasted to all users');
      }
    }
  },

  addSkipVote: async (songId: string) => {
    const { session, currentParticipant, realtime } = get();
    if (!session || !currentParticipant) return;

    // Check database directly for existing vote (more reliable than local state)
    const { data: existingVotes } = await supabase
      .from('skip_votes')
      .select('id')
      .eq('session_id', session.id)
      .eq('song_id', songId)
      .eq('participant_id', currentParticipant.id);

    if (existingVotes && existingVotes.length > 0) {
      console.log('Already voted to skip this song');
      return;
    }

    // Add skip vote
    const { error, data: voteData } = await supabase
      .from('skip_votes')
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Supabase types issue
      .insert([
        {
          session_id: session.id,
          song_id: songId,
          participant_id: currentParticipant.id,
        },
      ])
      .select()
      .single();

    if (error) {
      // If it's a duplicate key error, silently ignore (race condition)
      if (error.code === '23505') {
        console.log('Skip vote already exists (race condition handled)');
        return;
      }
      console.error('Error adding skip vote:', error);
      throw error;
    }

    // Reload skip votes to update immediately
    const { data } = await supabase
      .from('skip_votes')
      .select('*')
      .eq('session_id', session.id);

    if (data) {
      set({ skipVotes: data });
    }

    // Broadcast skip vote for instant updates
    if (realtime && voteData) {
      await realtime.broadcast.send('skip_vote_added', {
        skip_vote_id: voteData.id,
        song_id: songId,
        participant_id: currentParticipant.id,
        participant_name: currentParticipant.user_name || 'Anonymous',
        timestamp: Date.now(),
      });
      console.log('[Store] Skip vote broadcasted to all users');
    }
  },

  removeSkipVote: async (songId: string) => {
    const { session, currentParticipant, realtime } = get();
    if (!session || !currentParticipant) return;

    // Remove skip vote
    const { error } = await supabase
      .from('skip_votes')
      .delete()
      .eq('session_id', session.id)
      .eq('song_id', songId)
      .eq('participant_id', currentParticipant.id);

    if (error) {
      console.error('Error removing skip vote:', error);
      throw error;
    }

    // Reload skip votes to update immediately
    const { data } = await supabase
      .from('skip_votes')
      .select('*')
      .eq('session_id', session.id);

    if (data) {
      set({ skipVotes: data });
    }

    // Broadcast skip vote removal for instant updates
    if (realtime) {
      // We don't have the skip_vote_id since it was deleted, use a placeholder
      await realtime.broadcast.send('skip_vote_removed', {
        skip_vote_id: `${session.id}-${songId}-${currentParticipant.id}`,
        song_id: songId,
        participant_id: currentParticipant.id,
        timestamp: Date.now(),
      });
      console.log('[Store] Skip vote removal broadcasted to all users');
    }
  },

  addReaction: async (songId: string, emoji: string) => {
    const { session, currentParticipant, realtime } = get();
    if (!session || !currentParticipant) return;

    // Add reaction to database
    const { error } = await supabase
      .from('reactions')
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Supabase types issue
      .insert([
        {
          session_id: session.id,
          song_id: songId,
          participant_id: currentParticipant.id,
          emoji,
        },
      ]);

    if (error) {
      // If duplicate (user already reacted with this emoji), silently ignore
      if (error.code === '23505') {
        console.log('Already reacted with this emoji');
        return;
      }
      console.error('Error adding reaction:', error);
      throw error;
    }

    // Reload reactions
    const { data } = await supabase
      .from('reactions')
      .select('*')
      .eq('session_id', session.id);

    if (data) {
      set({ reactions: data });
    }

    // Broadcast reaction for instant updates
    if (realtime) {
      await realtime.broadcast.send('song_reaction', {
        participant_id: currentParticipant.id,
        participant_name: currentParticipant.user_name || 'Anonymous',
        emoji,
        timestamp: Date.now(),
      });
      console.log('[Store] Reaction broadcasted');
    }
  },

  removeReaction: async (songId: string, emoji: string) => {
    const { session, currentParticipant, realtime } = get();
    if (!session || !currentParticipant) return;

    // Remove reaction
    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('session_id', session.id)
      .eq('song_id', songId)
      .eq('participant_id', currentParticipant.id)
      .eq('emoji', emoji);

    if (error) {
      console.error('Error removing reaction:', error);
      throw error;
    }

    // Reload reactions
    const { data } = await supabase
      .from('reactions')
      .select('*')
      .eq('session_id', session.id);

    if (data) {
      set({ reactions: data });
    }

    // Broadcast reaction removal for instant updates
    if (realtime) {
      await realtime.broadcast.send('song_reaction', {
        participant_id: currentParticipant.id,
        participant_name: currentParticipant.user_name || 'Anonymous',
        emoji,
        timestamp: Date.now(),
      });
      console.log('[Store] Reaction removal broadcasted');
    }
  },

  loadChatMessages: async (songId: string) => {
    const { session } = get();
    if (!session) return;

    // Load chat messages for this song
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .eq('song_id', songId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading chat messages:', error);
      throw error;
    }

    if (data) {
      set({ chatMessages: data });
    }
  },

  sendChatMessage: async (songId: string, message: string) => {
    const { session, currentParticipant, realtime } = get();
    if (!session || !currentParticipant) return;

    // Insert chat message
    const { error, data } = await supabase
      .from('chat_messages')
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - Supabase types issue
      .insert([
        {
          session_id: session.id,
          song_id: songId,
          participant_id: currentParticipant.id,
          message,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error sending chat message:', error);
      throw error;
    }

    // Reload chat messages
    const { data: allMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', session.id)
      .eq('song_id', songId)
      .order('created_at', { ascending: true });

    if (allMessages) {
      set({ chatMessages: allMessages });
    }

    // Broadcast chat message for instant updates
    if (realtime && data) {
      await realtime.broadcast.send('chat_message', {
        id: data.id,
        song_id: songId,
        participant_id: currentParticipant.id,
        participant_name: currentParticipant.user_name || 'Anonymous',
        message,
        timestamp: Date.now(),
      });
      console.log('[Store] Chat message broadcasted');
    }
  },

  forcePlaySong: async (songId: string, participantId: string) => {
    const { session, songs } = get();
    if (!session) return;

    // Find the song position
    const song = songs.find((s) => s.id === songId);
    if (!song) return;

    // Record the force play
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - Supabase types issue
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
    if (!session || session.current_song_index === null) return;

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

  awardKarma: async (participantId: string, amount: number, reason: string) => {
    const { session, participants } = get();
    if (!session) return;

    try {
      // 1. Add karma history entry
      const { error: historyError } = await supabase
        .from('karma_history')
        .insert({
          participant_id: participantId,
          session_id: session.id,
          amount,
          reason,
        });

      if (historyError) {
        console.error('Error adding karma history:', historyError);
        return;
      }

      // 2. Update participant's total karma
      const participant = participants.find(p => p.id === participantId);
      if (!participant) return;

      const newKarma = (participant.karma || 0) + amount;

      const { error: updateError } = await supabase
        .from('participants')
        .update({ karma: newKarma })
        .eq('id', participantId);

      if (updateError) {
        console.error('Error updating participant karma:', updateError);
        return;
      }

      // 3. Update local state
      const updatedParticipants = participants.map(p =>
        p.id === participantId ? { ...p, karma: newKarma } : p
      );
      set({ participants: updatedParticipants });

      console.log(`[Store] Awarded ${amount} karma to participant ${participantId}: ${reason}`);
    } catch (error) {
      console.error('Error awarding karma:', error);
    }
  },

  reset: () => {
    get().unsubscribeFromSession();
    set({
      session: null,
      participants: [],
      songs: [],
      scores: [],
      skipVotes: [],
      reactions: [],
      chatMessages: [],
      currentParticipant: null,
      realtime: null,
      onlineUsers: [],
    });
  },
}));
