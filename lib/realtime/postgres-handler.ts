import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Session = Database['public']['Tables']['sessions']['Row'];
type Participant = Database['public']['Tables']['participants']['Row'];
type Song = Database['public']['Tables']['songs']['Row'];
type Score = Database['public']['Tables']['scores']['Row'];

/**
 * PostgresHandler listens to database changes via WebSocket.
 *
 * Key concepts:
 * - Listens to INSERT, UPDATE, DELETE events on database tables
 * - Data is persisted (stored permanently)
 * - Higher latency than broadcast (requires DB trigger + query)
 * - Perfect for: critical data, songs, session state
 *
 * How it works:
 * 1. Database change occurs (INSERT/UPDATE/DELETE)
 * 2. Postgres triggers a notification
 * 3. Supabase Realtime receives the notification
 * 4. WebSocket message sent to all subscribed clients
 * 5. Clients receive the change event
 *
 * Note: The event contains the row data, but we often re-query
 * for complex joins or to ensure consistency.
 */

export type PostgresChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface PostgresChange<T = unknown> {
  eventType: PostgresChangeEvent;
  new: T | null;
  old: T | null;
  table: string;
}

export type PostgresCallback<T = unknown> = (change: PostgresChange<T>) => void;

/**
 * PostgresHandler manages database change subscriptions
 */
export class PostgresHandler {
  private channel: RealtimeChannel;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor(channel: RealtimeChannel) {
    this.channel = channel;
  }

  /**
   * Listen to changes on the sessions table
   *
   * @param sessionId - Filter to specific session
   * @param callback - Function called when session changes
   * @param event - Type of change to listen for (default: all)
   *
   * Example:
   * ```typescript
   * postgres.onSession(sessionId, (change) => {
   *   if (change.eventType === 'UPDATE') {
   *     console.log('Session updated:', change.new);
   *     updateSessionState(change.new);
   *   }
   * });
   * ```
   */
  onSession(
    sessionId: string,
    callback: PostgresCallback<Session>,
    event: PostgresChangeEvent = '*'
  ): () => void {
    const key = `sessions:${sessionId}:${event}`;
    return this.listen('sessions', `id=eq.${sessionId}`, event, callback, key);
  }

  /**
   * Listen to changes on the participants table
   *
   * @param sessionId - Filter to specific session
   * @param callback - Function called when participants change
   * @param event - Type of change to listen for (default: all)
   *
   * Example:
   * ```typescript
   * postgres.onParticipants(sessionId, (change) => {
   *   if (change.eventType === 'INSERT') {
   *     console.log('New participant:', change.new);
   *     showNotification(`${change.new.user_name} joined!`);
   *   }
   * });
   * ```
   */
  onParticipants(
    sessionId: string,
    callback: PostgresCallback<Participant>,
    event: PostgresChangeEvent = '*'
  ): () => void {
    const key = `participants:${sessionId}:${event}`;
    return this.listen('participants', `session_id=eq.${sessionId}`, event, callback, key);
  }

  /**
   * Listen to changes on the songs table
   *
   * @param sessionId - Filter to specific session
   * @param callback - Function called when songs change
   * @param event - Type of change to listen for (default: all)
   *
   * Example:
   * ```typescript
   * postgres.onSongs(sessionId, (change) => {
   *   if (change.eventType === 'INSERT') {
   *     console.log('Song added:', change.new);
   *   } else if (change.eventType === 'DELETE') {
   *     console.log('Song removed:', change.old);
   *   }
   *   reloadSongs(); // Refresh the queue
   * });
   * ```
   */
  onSongs(
    sessionId: string,
    callback: PostgresCallback<Song>,
    event: PostgresChangeEvent = '*'
  ): () => void {
    const key = `songs:${sessionId}:${event}`;
    return this.listen('songs', `session_id=eq.${sessionId}`, event, callback, key);
  }

  /**
   * Listen to changes on the scores table
   *
   * @param sessionId - Filter to specific session
   * @param callback - Function called when scores change
   * @param event - Type of change to listen for (default: all)
   *
   * Example:
   * ```typescript
   * postgres.onScores(sessionId, (change) => {
   *   if (change.eventType === 'INSERT') {
   *     console.log('Score added:', change.new);
   *     // Note: Broadcast already handled the live update!
   *     // This is just for persistence confirmation
   *   }
   * });
   * ```
   */
  onScores(
    sessionId: string,
    callback: PostgresCallback<Score>,
    event: PostgresChangeEvent = '*'
  ): () => void {
    const key = `scores:${sessionId}:${event}`;
    return this.listen('scores', `session_id=eq.${sessionId}`, event, callback, key);
  }

  /**
   * Generic listener for any table
   * (Internal method - use specific methods above for type safety)
   */
  private listen<T>(
    table: string,
    filter: string,
    event: PostgresChangeEvent,
    callback: PostgresCallback<T>,
    key: string
  ): () => void {
    // Store the callback
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback as (...args: unknown[]) => void);

    // Set up the Supabase listener
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.channel as any).on(
      'postgres_changes',
      {
        event,
        schema: 'public',
        table,
        filter,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload: any) => {
        const change: PostgresChange<T> = {
          eventType: payload.eventType as PostgresChangeEvent,
          new: payload.new as T | null,
          old: payload.old as T | null,
          table,
        };
        callback(change);
      }
    );

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        listeners.delete(callback as (...args: unknown[]) => void);
        if (listeners.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Remove all listeners
   */
  offAll(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of active listeners
   */
  listenerCount(): number {
    let count = 0;
    this.listeners.forEach((set) => {
      count += set.size;
    });
    return count;
  }
}
