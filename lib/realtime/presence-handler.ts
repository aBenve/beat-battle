import type { RealtimeChannel } from '@supabase/supabase-js';
import type { PresenceState, PresenceCallback } from './types';

/**
 * PresenceHandler tracks who's online and syncs their state across all clients.
 *
 * Key concepts:
 * - Tracks real-time user presence (who's online right now)
 * - Each user has a "state" that's synced to all clients
 * - Automatically handles disconnections
 * - Perfect for: online indicators, "who's listening", user status
 *
 * How it works:
 * 1. User joins → calls track() with their state
 * 2. State is sent to Supabase Realtime
 * 3. All connected clients receive "join" event
 * 4. User updates state → track() again → all clients get "sync" event
 * 5. User leaves/disconnects → all clients get "leave" event
 *
 * The server automatically detects disconnections!
 */
export class PresenceHandler {
  private channel: RealtimeChannel;
  private listeners: Set<PresenceCallback> = new Set();
  private currentState: PresenceState | null = null;

  constructor(channel: RealtimeChannel) {
    this.channel = channel;
    this.setupPresenceListeners();
  }

  /**
   * Set up internal presence event listeners
   * These will trigger our callbacks when presence changes
   */
  private setupPresenceListeners(): void {
    // Sync event - called when presence state is synchronized
    this.channel.on('presence', { event: 'sync' }, () => {
      const state = this.channel.presenceState();
      this.notifyListeners({
        event: 'sync',
        currentPresences: state as Record<string, PresenceState[]>,
      });
    });

    // Join event - someone joined the channel
    this.channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      this.notifyListeners({
        event: 'join',
        key,
        newPresences: newPresences as PresenceState[],
      });
    });

    // Leave event - someone left the channel
    this.channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      this.notifyListeners({
        event: 'leave',
        key,
        leftPresences: leftPresences as PresenceState[],
      });
    });
  }

  /**
   * Track your presence - tells everyone "I'm here!" with your state
   *
   * @param state - Your current state to share with others
   *
   * Example:
   * ```typescript
   * await presence.track({
   *   user_id: '123',
   *   user_name: 'John',
   *   is_host: false,
   *   is_listening: true,
   *   joined_at: new Date().toISOString(),
   *   last_active: Date.now()
   * });
   * ```
   *
   * You can call this multiple times to update your state!
   */
  async track(state: PresenceState): Promise<'ok' | 'timed out' | 'rate limited'> {
    this.currentState = state;
    return this.channel.track(state);
  }

  /**
   * Stop tracking your presence - tells everyone "I'm leaving!"
   *
   * Example:
   * ```typescript
   * await presence.untrack();
   * ```
   */
  async untrack(): Promise<'ok' | 'timed out' | 'rate limited'> {
    this.currentState = null;
    return this.channel.untrack();
  }

  /**
   * Update your presence state (shorthand for track)
   * Useful when you want to update just one field
   *
   * Example:
   * ```typescript
   * // Update listening status
   * presence.update({ is_listening: false });
   * ```
   */
  async update(partialState: Partial<PresenceState>): Promise<'ok' | 'timed out' | 'rate limited'> {
    if (!this.currentState) {
      throw new Error('Cannot update presence before tracking. Call track() first.');
    }

    const newState = { ...this.currentState, ...partialState };
    return this.track(newState);
  }

  /**
   * Get the current presence state of all users
   *
   * Returns a map of user keys to their presence states
   * Note: Users can have multiple presence states (e.g., multiple tabs open)
   *
   * Example:
   * ```typescript
   * const allUsers = presence.getState();
   * // allUsers = {
   * //   "user-123": [{ user_id: "123", user_name: "John", ... }],
   * //   "user-456": [{ user_id: "456", user_name: "Jane", ... }]
   * // }
   * ```
   */
  getState(): Record<string, PresenceState[]> {
    return this.channel.presenceState() as Record<string, PresenceState[]>;
  }

  /**
   * Get a flattened array of all online users
   * Easier to work with than the grouped format
   *
   * Example:
   * ```typescript
   * const users = presence.getUsers();
   * // users = [
   * //   { user_id: "123", user_name: "John", ... },
   * //   { user_id: "456", user_name: "Jane", ... }
   * // ]
   * ```
   */
  getUsers(): PresenceState[] {
    const state = this.getState();
    const users: PresenceState[] = [];

    // Flatten the grouped structure
    Object.values(state).forEach((presences) => {
      users.push(...presences);
    });

    return users;
  }

  /**
   * Get the count of online users
   */
  getUserCount(): number {
    return Object.keys(this.getState()).length;
  }

  /**
   * Check if a specific user is online
   *
   * @param userId - The user ID to check
   */
  isUserOnline(userId: string): boolean {
    const users = this.getUsers();
    return users.some((u) => u.user_id === userId);
  }

  /**
   * Listen to presence changes
   *
   * @param callback - Function called when presence changes
   * @returns Unsubscribe function
   *
   * Example:
   * ```typescript
   * const unsubscribe = presence.onChange((payload) => {
   *   if (payload.event === 'join') {
   *     console.log('User joined:', payload.newPresences);
   *   } else if (payload.event === 'leave') {
   *     console.log('User left:', payload.leftPresences);
   *   } else if (payload.event === 'sync') {
   *     console.log('All users:', payload.currentPresences);
   *   }
   * });
   * ```
   */
  onChange(callback: PresenceCallback): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Notify all listeners of a presence change
   */
  private notifyListeners(payload: Parameters<PresenceCallback>[0]): void {
    this.listeners.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        console.error('Error in presence callback:', error);
      }
    });
  }

  /**
   * Remove all presence listeners
   */
  offAll(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of active listeners
   */
  listenerCount(): number {
    return this.listeners.size;
  }
}
