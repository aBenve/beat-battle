import type { RealtimeChannel } from '@supabase/supabase-js';
import type { BroadcastEvents, BroadcastCallback } from './types';

/**
 * BroadcastHandler manages ephemeral (temporary) messages between clients.
 *
 * Key concepts:
 * - Messages are NOT stored in the database
 * - Ultra-low latency (10-50ms typically)
 * - Perfect for: live scores, chat, typing indicators, reactions
 *
 * How it works:
 * 1. Client A sends a broadcast message via WebSocket
 * 2. Supabase Realtime server receives it
 * 3. Server immediately broadcasts to all clients in the same channel
 * 4. Clients receive and handle the message
 *
 * No database round-trip needed!
 */
export class BroadcastHandler {
  private channel: RealtimeChannel;
  private listeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  constructor(channel: RealtimeChannel) {
    this.channel = channel;
  }

  /**
   * Send a broadcast message to all connected clients
   *
   * @param event - The event type (e.g., 'score_added', 'chat_message')
   * @param payload - The data to send
   *
   * Example:
   * ```typescript
   * broadcast.send('score_added', {
   *   song_id: '123',
   *   participant_name: 'John',
   *   rating: 5,
   *   timestamp: Date.now()
   * });
   * ```
   */
  send<T extends keyof BroadcastEvents>(
    event: T,
    payload: BroadcastEvents[T]
  ): Promise<'ok' | 'timed out' | 'rate limited' | 'error'> {
    return this.channel.send({
      type: 'broadcast',
      event,
      payload,
    });
  }

  /**
   * Listen for broadcast messages of a specific event type
   *
   * @param event - The event type to listen for
   * @param callback - Function called when message received
   * @returns Unsubscribe function
   *
   * Example:
   * ```typescript
   * const unsubscribe = broadcast.on('score_added', (data) => {
   *   console.log(`${data.participant_name} rated ${data.rating} stars`);
   *   updateScoreUI(data);
   * });
   *
   * // Later, stop listening
   * unsubscribe();
   * ```
   */
  on<T extends keyof BroadcastEvents>(
    event: T,
    callback: BroadcastCallback<T>
  ): () => void {
    // Store the callback so we can unsubscribe later
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (...args: unknown[]) => void);

    // Set up the actual Supabase listener
    this.channel.on('broadcast', { event }, ({ payload }) => {
      callback(payload as BroadcastEvents[T]);
    });

    // Return unsubscribe function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.delete(callback as (...args: unknown[]) => void);
        if (eventListeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }

  /**
   * Remove all listeners for a specific event
   */
  off(event: keyof BroadcastEvents): void {
    this.listeners.delete(event);
  }

  /**
   * Remove all listeners for all events
   */
  offAll(): void {
    this.listeners.clear();
  }

  /**
   * Get the number of active listeners for an event
   */
  listenerCount(event: keyof BroadcastEvents): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}
