import { z } from 'zod';

/**
 * Real-time wire protocol. Every frame is a JSON object with a `t` (type) field.
 * Clients on any platform (Unity, Godot, Unreal, Flutter, native, web) speak it over a
 * plain WebSocket. See docs/REALTIME.md for the full message reference.
 */

const gameId = z.string().min(1).max(64);

export const clientMessageSchema = z.discriminatedUnion('t', [
  /** Authenticate when the platform can't set an Authorization header (e.g. browsers). */
  z.object({ t: z.literal('auth'), token: z.string().min(1).max(4096) }),
  z.object({ t: z.literal('ping'), ts: z.number().optional() }),
  z.object({ t: z.literal('queue.join'), gameId }),
  z.object({ t: z.literal('queue.leave') }),
  /** Private room with an invite code (multiplayer) or an authoritative solo run. */
  z.object({
    t: z.literal('room.create'),
    gameId,
    mode: z.enum(['solo', 'multiplayer']).default('multiplayer'),
    /** Seats in the room (e.g. 1, 2 or 3 for an ATHAR party). Defaults to the game's maximum. */
    partySize: z.number().int().min(1).max(16).optional(),
    /** Game-specific options, e.g. `{ "chapterId": "mecca" }`. */
    options: z.unknown().optional(),
  }),
  z.object({ t: z.literal('room.join'), code: z.string().min(4).max(12) }),
  z.object({ t: z.literal('room.ready'), ready: z.boolean() }),
  z.object({ t: z.literal('room.start') }),
  z.object({ t: z.literal('room.leave') }),
  z.object({ t: z.literal('input'), seq: z.number().int().nonnegative(), data: z.unknown() }),
  z.object({ t: z.literal('chat'), text: z.string().trim().min(1).max(280) }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface RoomPlayerView {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  /** The playable character this player chose (traveler, steadfast, elder). */
  characterId: string | null;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}

export type RoomPhase = 'lobby' | 'countdown' | 'playing' | 'finished';

export interface RoomView {
  roomId: string;
  code: string | null;
  gameId: string;
  mode: 'solo' | 'multiplayer';
  phase: RoomPhase;
  minPlayers: number;
  maxPlayers: number;
  /** Seats chosen by the host; private rooms start only when every seat is filled. */
  partySize: number | null;
  options: unknown;
  players: RoomPlayerView[];
}

export type ServerMessage =
  | { t: 'welcome'; userId: string; serverTime: number; protocolVersion: number }
  | { t: 'pong'; ts?: number; serverTime: number }
  | { t: 'error'; code: string; message: string; details?: unknown }
  | { t: 'queue.joined'; gameId: string; position: number }
  | { t: 'queue.left' }
  | { t: 'match.found'; roomId: string; gameId: string }
  | { t: 'room.state'; room: RoomView }
  | { t: 'room.left'; roomId: string; reason: string }
  | { t: 'game.countdown'; startsAt: number; durationMs: number }
  | { t: 'game.start'; tickRate: number; serverTime: number }
  | { t: 'game.state'; tick: number; serverTime: number; ackSeq: number | null; state: unknown }
  | { t: 'game.event'; tick: number; event: unknown }
  | {
      t: 'game.end';
      matchId: string | null;
      results: { userId: string; displayName: string; score: number; placement: number; xp: number }[];
    }
  | { t: 'chat'; from: string; displayName: string; text: string; serverTime: number };

export const PROTOCOL_VERSION = 1;

/** Close codes (4000-4999 are application-defined). */
export const CloseCode = {
  Replaced: 4000,
  AuthFailed: 4001,
  AuthTimeout: 4002,
  RateLimited: 4008,
  ServerShutdown: 4010,
} as const;
