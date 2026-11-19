import type { z } from 'zod';

export type GameMode = 'solo' | 'multiplayer';

export interface PlayerResult {
  userId: string;
  score: number;
  /** 1 = winner. Players with equal scores share a placement. */
  placement: number;
}

/** A discrete thing that happened during a tick (e.g. "orb collected"), broadcast to clients. */
export interface GameEvent {
  type: string;
  [key: string]: unknown;
}

export type Rng = () => number;

/**
 * Everything the server needs to run a game authoritatively. The server owns the state;
 * clients only send validated inputs and render the snapshots they receive. Every game
 * (the real one you design, plus mini-modes) implements this interface and is registered
 * in `games/registry.ts`.
 */
export interface GameDefinition<State = unknown, Input = unknown, SoloResult = unknown> {
  id: string;
  name: string;
  description: string;
  modes: GameMode[];
  minPlayers: number;
  maxPlayers: number;
  /** Simulation ticks per second. Snapshots are broadcast every tick. */
  tickRate: number;
  /** Schema for a single player input message. Anything else is rejected. */
  inputSchema: z.ZodType<Input>;

  /** Room options chosen by the host (e.g. which chapter). Validated before the room is created. */
  optionsSchema?: z.ZodType<unknown>;
  /** Co-operative games: everyone shares the result, so no wins/losses or score leaderboards. */
  cooperative?: boolean;
  /** Whether strangers can be matched through the quick-match queue. Default true. */
  matchmaking?: boolean;
  /**
   * Async check/preparation before the countdown, e.g. verifying every player has unlocked
   * the chosen chapter. Throw an AppError to keep the room in the lobby with that message.
   */
  beforeStart?(playerIds: string[], options: unknown): Promise<void>;

  createState(playerIds: string[], rng: Rng, options: unknown): State;
  applyInput(state: State, playerId: string, input: Input): void;
  tick(state: State, dtMs: number, rng: Rng): GameEvent[];
  /** Called when a player leaves for good (disconnect grace period expired or they quit). */
  removePlayer(state: State, playerId: string): void;
  isOver(state: State): boolean;
  results(state: State): PlayerResult[];
  /** What `viewerId` is allowed to see. Lets games hide information (fog of war, hands). */
  snapshot(state: State, viewerId: string): unknown;
  /** XP awarded for a finished game. */
  xpFor(result: PlayerResult, playerCount: number): number;

  /**
   * Optional client-simulated single-player mode (works offline, result submitted later).
   * `validate` is the anti-cheat sanity check; return the score to record, or null to reject.
   */
  solo?: {
    resultSchema: z.ZodType<SoloResult>;
    validate(result: SoloResult, elapsedMs: number): number | null;
  };
}

// The registry stores games with erased type parameters.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any, any>;

/** Assign placements from scores (higher is better); ties share the same placement. */
export function rankByScore(scores: { userId: string; score: number }[]): PlayerResult[] {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  return sorted.map((s) => ({ ...s, placement: sorted.findIndex((o) => o.score === s.score) + 1 }));
}

/** Small, fast, seedable PRNG (mulberry32) so simulations are reproducible in tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
