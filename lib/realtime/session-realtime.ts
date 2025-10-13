import { supabase } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { BroadcastHandler } from './broadcast-handler';
import { PresenceHandler } from './presence-handler';
import { PostgresHandler } from './postgres-handler';
import type { RealtimeStatus, PresenceState } from './types';

/**
 * SessionRealtime - The main orchestrator for all real-time features
 *
 * This class combines all three real-time modes:
 * 1. Broadcast - Low-latency ephemeral messages (scores, chat)
 * 2. Presence - Track who's online and their state
 * 3. Postgres - Database change notifications (songs, session state)
 *
 * Usage:
 * ```typescript
 * const realtime = new SessionRealtime(sessionId);
 *
 * // Connect and set up subscriptions
 * await realtime.connect();
 *
 * // Track your presence
 * await realtime.trackPresence({
 *   user_id: '123',
 *   user_name: 'John',
 *   is_host: false,
 *   is_listening: true,
 *   joined_at: new Date().toISOString(),
 *   last_active: Date.now()
 * });
 *
 * // Listen to live score updates
 * realtime.broadcast.on('score_added', (data) => {
 *   console.log(`${data.participant_name} rated ${data.rating} stars`);
 * });
 *
 * // Listen to presence changes
 * realtime.presence.onChange((payload) => {
 *   if (payload.event === 'join') {
 *     console.log('User joined!');
 *   }
 * });
 *
 * // Listen to database changes
 * realtime.postgres.onSongs(sessionId, (change) => {
 *   console.log('Songs changed:', change);
 * });
 *
 * // Clean up when done
 * await realtime.disconnect();
 * ```
 */
export class SessionRealtime {
  private sessionId: string;
  private channel: RealtimeChannel | null = null;
  private _status: RealtimeStatus = 'idle';
  private statusListeners: Set<(status: RealtimeStatus) => void> = new Set();

  // Public handlers
  public broadcast!: BroadcastHandler;
  public presence!: PresenceHandler;
  public postgres!: PostgresHandler;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Connect to the real-time channel and initialize all handlers
   *
   * This establishes the WebSocket connection and sets up:
   * - Broadcast messaging
   * - Presence tracking
   * - Postgres change listeners
   */
  async connect(): Promise<void> {
    if (this.channel) {
      console.warn('Already connected to realtime channel');
      return;
    }

    this.updateStatus('connecting');

    try {
      // Create a Supabase Realtime channel
      // Channel name format: "session:{sessionId}"
      this.channel = supabase.channel(`session:${this.sessionId}`, {
        config: {
          // Enable broadcast with acknowledgment
          broadcast: { ack: true, self: false },
          // Enable presence tracking
          presence: { key: '' }, // Key will be set per user
        },
      });

      // Initialize handlers
      this.broadcast = new BroadcastHandler(this.channel);
      this.presence = new PresenceHandler(this.channel);
      this.postgres = new PostgresHandler(this.channel);

      // Subscribe to the channel
      const subscribePromise = new Promise<void>((resolve, reject) => {
        this.channel!.subscribe((status) => {
          console.log(`[Realtime] Channel status: ${status}`);

          if (status === 'SUBSCRIBED') {
            this.updateStatus('subscribed');
            resolve();
          } else if (status === 'CHANNEL_ERROR') {
            this.updateStatus('error');
            reject(new Error('Failed to subscribe to realtime channel'));
          } else if (status === 'TIMED_OUT') {
            this.updateStatus('error');
            reject(new Error('Realtime subscription timed out'));
          } else if (status === 'CLOSED') {
            this.updateStatus('closed');
          }
        });
      });

      await subscribePromise;
      console.log('[Realtime] Successfully connected');
    } catch (error) {
      this.updateStatus('error');
      console.error('[Realtime] Connection error:', error);
      throw error;
    }
  }

  /**
   * Disconnect from the real-time channel and clean up
   */
  async disconnect(): Promise<void> {
    if (!this.channel) {
      return;
    }

    console.log('[Realtime] Disconnecting...');

    // Untrack presence before leaving
    if (this.presence) {
      try {
        await this.presence.untrack();
      } catch (error) {
        console.error('[Realtime] Error untracking presence:', error);
      }
    }

    // Clean up handlers
    this.broadcast?.offAll();
    this.presence?.offAll();
    this.postgres?.offAll();

    // Remove the channel
    await supabase.removeChannel(this.channel);
    this.channel = null;

    this.updateStatus('closed');
    console.log('[Realtime] Disconnected');
  }

  /**
   * Track your presence in the session
   * Convenience method that wraps presence.track()
   */
  async trackPresence(state: PresenceState): Promise<void> {
    if (!this.presence) {
      throw new Error('Not connected. Call connect() first.');
    }

    const result = await this.presence.track(state);
    if (result !== 'ok') {
      console.warn('[Realtime] Presence tracking result:', result);
    }
  }

  /**
   * Update your presence state
   * Convenience method that wraps presence.update()
   */
  async updatePresence(partialState: Partial<PresenceState>): Promise<void> {
    if (!this.presence) {
      throw new Error('Not connected. Call connect() first.');
    }

    const result = await this.presence.update(partialState);
    if (result !== 'ok') {
      console.warn('[Realtime] Presence update result:', result);
    }
  }

  /**
   * Get the current connection status
   */
  get status(): RealtimeStatus {
    return this._status;
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this._status === 'subscribed';
  }

  /**
   * Listen to status changes
   *
   * Example:
   * ```typescript
   * realtime.onStatusChange((status) => {
   *   console.log('Connection status:', status);
   *   if (status === 'error') {
   *     // Handle reconnection
   *   }
   * });
   * ```
   */
  onStatusChange(callback: (status: RealtimeStatus) => void): () => void {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  /**
   * Update the connection status and notify listeners
   */
  private updateStatus(status: RealtimeStatus): void {
    this._status = status;
    this.statusListeners.forEach((callback) => {
      try {
        callback(status);
      } catch (error) {
        console.error('[Realtime] Error in status callback:', error);
      }
    });
  }

  /**
   * Get debug information about the realtime connection
   */
  getDebugInfo(): {
    sessionId: string;
    status: RealtimeStatus;
    isConnected: boolean;
    broadcastListeners: number;
    presenceListeners: number;
    postgresListeners: number;
    onlineUsers: number;
  } {
    return {
      sessionId: this.sessionId,
      status: this._status,
      isConnected: this.isConnected,
      broadcastListeners: this.broadcast?.listenerCount('score_added') ?? 0,
      presenceListeners: this.presence?.listenerCount() ?? 0,
      postgresListeners: this.postgres?.listenerCount() ?? 0,
      onlineUsers: this.presence?.getUserCount() ?? 0,
    };
  }
}
