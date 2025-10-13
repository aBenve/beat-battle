/**
 * Real-time module for BeatBattle
 *
 * Provides three types of real-time functionality:
 * 1. Broadcast - Ephemeral messages (scores, chat, reactions)
 * 2. Presence - Track online users and their state
 * 3. Postgres - Database change notifications
 *
 * @example
 * ```typescript
 * import { SessionRealtime } from '@/lib/realtime';
 *
 * const realtime = new SessionRealtime(sessionId);
 * await realtime.connect();
 *
 * // Use broadcast for instant updates
 * realtime.broadcast.send('score_added', { ... });
 *
 * // Track who's online
 * await realtime.trackPresence({ ... });
 *
 * // Listen to database changes
 * realtime.postgres.onSongs(sessionId, (change) => { ... });
 * ```
 */

export { SessionRealtime } from './session-realtime';
export { BroadcastHandler } from './broadcast-handler';
export { PresenceHandler } from './presence-handler';
export { PostgresHandler } from './postgres-handler';

export type {
  BroadcastEvents,
  BroadcastCallback,
  PresenceState,
  PresenceEvent,
  PresencePayload,
  PresenceCallback,
  RealtimeStatus,
} from './types';

export type {
  PostgresChangeEvent,
  PostgresChange,
  PostgresCallback,
} from './postgres-handler';
