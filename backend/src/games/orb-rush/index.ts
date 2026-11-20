import { z } from 'zod';
import { rankByScore, type GameDefinition, type GameEvent, type Rng } from '../types.js';

/**
 * Orb Rush — a reference game that exercises the whole stack (solo + real-time
 * multiplayer). Players steer around an arena collecting orbs before the clock runs out.
 * It is a placeholder to be replaced or joined by the real game.
 */

export const ARENA = { width: 1600, height: 900 };
const PLAYER_RADIUS = 28;
const ORB_RADIUS = 14;
const SPEED = 420; // units per second
const MAX_ORBS = 10;
const GOLDEN_CHANCE = 0.08;

interface Player {
  id: string;
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  score: number;
  active: boolean;
}

interface Orb {
  id: number;
  x: number;
  y: number;
  value: number;
}

export interface OrbRushState {
  players: Map<string, Player>;
  orbs: Orb[];
  nextOrbId: number;
  remainingMs: number;
}

const inputSchema = z.object({
  // Desired movement direction from a joystick / WASD / touch drag; clamped to unit length.
  dx: z.number().finite().min(-1).max(1),
  dy: z.number().finite().min(-1).max(1),
});
type Input = z.infer<typeof inputSchema>;

const soloResultSchema = z.object({ score: z.number().int().min(0) });

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function spawnOrb(state: OrbRushState, rng: Rng): Orb {
  const orb: Orb = {
    id: state.nextOrbId++,
    x: ORB_RADIUS + rng() * (ARENA.width - 2 * ORB_RADIUS),
    y: ORB_RADIUS + rng() * (ARENA.height - 2 * ORB_RADIUS),
    value: rng() < GOLDEN_CHANCE ? 5 : 1,
  };
  state.orbs.push(orb);
  return orb;
}

export function createOrbRush(opts: { roundMs?: number } = {}): GameDefinition<OrbRushState, Input, z.infer<typeof soloResultSchema>> {
  const roundMs = opts.roundMs ?? 60_000;
  // Generous ceiling on how fast a legit player can score, for solo anti-cheat.
  const maxPointsPerSecond = 4;

  return {
    id: 'orb-rush',
    name: 'Orb Rush',
    description: 'Collect glowing orbs before time runs out. Golden orbs are worth 5.',
    modes: ['solo', 'multiplayer'],
    minPlayers: 1,
    maxPlayers: 8,
    tickRate: 20,
    inputSchema,

    createState(playerIds, rng) {
      const players = new Map<string, Player>();
      playerIds.forEach((id, i) => {
        const angle = (i / playerIds.length) * Math.PI * 2;
        players.set(id, {
          id,
          x: ARENA.width / 2 + Math.cos(angle) * 250,
          y: ARENA.height / 2 + Math.sin(angle) * 250,
          dirX: 0,
          dirY: 0,
          score: 0,
          active: true,
        });
      });
      const state: OrbRushState = { players, orbs: [], nextOrbId: 1, remainingMs: roundMs };
      for (let i = 0; i < MAX_ORBS; i++) spawnOrb(state, rng);
      return state;
    },

    applyInput(state, playerId, { dx, dy }) {
      const p = state.players.get(playerId);
      if (!p?.active) return;
      const len = Math.hypot(dx, dy);
      p.dirX = len > 1 ? dx / len : dx;
      p.dirY = len > 1 ? dy / len : dy;
    },

    tick(state, dtMs, rng) {
      const events: GameEvent[] = [];
      const dt = dtMs / 1000;
      state.remainingMs = Math.max(0, state.remainingMs - dtMs);
      for (const p of state.players.values()) {
        if (!p.active) continue;
        p.x = clamp(p.x + p.dirX * SPEED * dt, PLAYER_RADIUS, ARENA.width - PLAYER_RADIUS);
        p.y = clamp(p.y + p.dirY * SPEED * dt, PLAYER_RADIUS, ARENA.height - PLAYER_RADIUS);
        for (let i = state.orbs.length - 1; i >= 0; i--) {
          const orb = state.orbs[i]!;
          if (Math.hypot(orb.x - p.x, orb.y - p.y) <= PLAYER_RADIUS + ORB_RADIUS) {
            p.score += orb.value;
            state.orbs.splice(i, 1);
            events.push({ type: 'orb.collected', playerId: p.id, orbId: orb.id, value: orb.value });
          }
        }
      }
      while (state.orbs.length < MAX_ORBS) spawnOrb(state, rng);
      return events;
    },

    removePlayer(state, playerId) {
      const p = state.players.get(playerId);
      if (p) p.active = false;
    },

    isOver(state) {
      return state.remainingMs <= 0 || ![...state.players.values()].some((p) => p.active);
    },

    results(state) {
      return rankByScore([...state.players.values()].map((p) => ({ userId: p.id, score: p.score })));
    },

    snapshot(state) {
      return {
        arena: ARENA,
        remainingMs: Math.round(state.remainingMs),
        players: [...state.players.values()].map((p) => ({
          id: p.id,
          x: Math.round(p.x),
          y: Math.round(p.y),
          score: p.score,
          active: p.active,
        })),
        orbs: state.orbs.map((o) => ({ id: o.id, x: Math.round(o.x), y: Math.round(o.y), value: o.value })),
      };
    },

    xpFor(result, playerCount) {
      const winBonus = result.placement === 1 && playerCount > 1 ? 50 : 0;
      return 10 + result.score + winBonus;
    },

    solo: {
      resultSchema: soloResultSchema,
      validate({ score }, elapsedMs) {
        if (elapsedMs < 1_000) return null;
        const maxPossible = Math.ceil((Math.min(elapsedMs, roundMs + 5_000) / 1000) * maxPointsPerSecond);
        return score <= maxPossible ? score : null;
      },
    },
  };
}
