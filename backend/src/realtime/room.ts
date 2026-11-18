import { randomUUID } from 'node:crypto';
import type { FastifyBaseLogger } from 'fastify';
import type { AnyGameDefinition, GameMode, PlayerResult, Rng } from '../games/types.js';
import { seededRng } from '../games/types.js';
import type { Connection } from './connection.js';
import type { RoomPhase, RoomView, ServerMessage } from './protocol.js';

export interface RoomTimings {
  countdownMs: number;
  reconnectGraceMs: number;
  /** How long a finished room lingers so clients can read results. */
  finishedLingerMs: number;
}

export interface RoomPlayer {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  connection: Connection | null;
  ready: boolean;
  /** Has permanently left the match (quit or grace expired). */
  gone: boolean;
  lastSeq: number | null;
  pendingInputs: { seq: number; data: unknown }[];
  graceTimer: NodeJS.Timeout | null;
}

export interface FinishedMatch {
  matchId: string | null;
  results: (PlayerResult & { xp: number })[];
}

export interface RoomHooks {
  onFinished(room: Room, results: PlayerResult[]): Promise<FinishedMatch>;
  onPlayerLeft(room: Room, userId: string): void;
  onDisposed(room: Room): void;
}

const MAX_INPUTS_PER_TICK = 8;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion

export const randomRoomCode = () =>
  Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

/**
 * A single game instance. The room owns the authoritative state and runs the fixed-rate
 * simulation loop; players' sockets come and go (reconnects are supported mid-match).
 */
export class Room {
  readonly id = randomUUID();
  readonly players = new Map<string, RoomPlayer>();
  phase: RoomPhase = 'lobby';
  hostId: string | null = null;
  startedAt: Date | null = null;

  private state: unknown = null;
  private tickNo = 0;
  private loop: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private lastTickAt = 0;
  private readonly rng: Rng = seededRng(Math.floor(Math.random() * 2 ** 32));

  constructor(
    readonly game: AnyGameDefinition,
    readonly mode: GameMode,
    readonly code: string | null,
    private readonly timings: RoomTimings,
    private readonly hooks: RoomHooks,
    private readonly log: FastifyBaseLogger,
  ) {}

  get activePlayers(): RoomPlayer[] {
    return [...this.players.values()].filter((p) => !p.gone);
  }

  get isFull() {
    return this.activePlayers.length >= (this.mode === 'solo' ? 1 : this.game.maxPlayers);
  }

  view(): RoomView {
    return {
      roomId: this.id,
      code: this.code,
      gameId: this.game.id,
      mode: this.mode,
      phase: this.phase,
      minPlayers: this.mode === 'solo' ? 1 : this.game.minPlayers,
      maxPlayers: this.mode === 'solo' ? 1 : this.game.maxPlayers,
      players: this.activePlayers.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        ready: p.ready,
        connected: p.connection?.open === true,
        isHost: p.userId === this.hostId,
      })),
    };
  }

  broadcast(msg: ServerMessage): void {
    for (const p of this.players.values()) p.connection?.send(msg);
  }

  private broadcastState() {
    this.broadcast({ t: 'room.state', room: this.view() });
  }

  addPlayer(conn: Connection): void {
    this.players.set(conn.userId, {
      userId: conn.userId,
      displayName: conn.displayName,
      avatarUrl: conn.avatarUrl,
      connection: conn,
      ready: false,
      gone: false,
      lastSeq: null,
      pendingInputs: [],
      graceTimer: null,
    });
    this.hostId ??= conn.userId;
    this.broadcastState();
  }

  /** Re-attach a player's new socket (app restart, network switch, etc.). */
  reattach(conn: Connection): void {
    const p = this.players.get(conn.userId);
    if (!p || p.gone) return;
    if (p.graceTimer) clearTimeout(p.graceTimer);
    p.graceTimer = null;
    p.connection = conn;
    conn.send({ t: 'room.state', room: this.view() });
    if (this.phase === 'playing') {
      conn.send({ t: 'game.start', tickRate: this.game.tickRate, serverTime: Date.now() });
    }
    this.broadcastState();
  }

  setReady(userId: string, ready: boolean): void {
    const p = this.players.get(userId);
    if (!p || this.phase !== 'lobby') return;
    p.ready = ready;
    this.broadcastState();
  }

  canStart(): string | null {
    if (this.phase !== 'lobby') return 'Game already started';
    const active = this.activePlayers;
    const min = this.mode === 'solo' ? 1 : this.game.minPlayers;
    if (active.length < min) return `Need at least ${min} players`;
    if (active.some((p) => !p.ready && p.userId !== this.hostId)) return 'Not everyone is ready';
    return null;
  }

  /** Begin the pre-game countdown, then the simulation. */
  start(): void {
    if (this.phase !== 'lobby') return;
    this.phase = 'countdown';
    const startsAt = Date.now() + this.timings.countdownMs;
    this.broadcastState();
    this.broadcast({ t: 'game.countdown', startsAt, durationMs: this.timings.countdownMs });
    this.countdownTimer = setTimeout(() => this.beginPlaying(), this.timings.countdownMs);
  }

  private beginPlaying() {
    this.countdownTimer = null;
    const ids = this.activePlayers.map((p) => p.userId);
    if (ids.length === 0) return this.dispose();
    this.state = this.game.createState(ids, this.rng);
    this.phase = 'playing';
    this.startedAt = new Date();
    this.lastTickAt = performance.now();
    this.broadcastState();
    this.broadcast({ t: 'game.start', tickRate: this.game.tickRate, serverTime: Date.now() });
    this.loop = setInterval(() => this.step(), 1000 / this.game.tickRate);
  }

  queueInput(userId: string, seq: number, data: unknown): string | null {
    if (this.phase !== 'playing') return 'Game is not running';
    const p = this.players.get(userId);
    if (!p || p.gone) return 'Not in this game';
    const parsed = this.game.inputSchema.safeParse(data);
    if (!parsed.success) return 'Invalid input';
    if (p.lastSeq !== null && seq <= p.lastSeq) return null; // stale/duplicate, drop quietly
    p.pendingInputs.push({ seq, data: parsed.data });
    if (p.pendingInputs.length > MAX_INPUTS_PER_TICK) p.pendingInputs.shift();
    return null;
  }

  private step() {
    const now = performance.now();
    // Clamp dt so a stalled event loop can't teleport players.
    const dt = Math.min(now - this.lastTickAt, (3 * 1000) / this.game.tickRate);
    this.lastTickAt = now;
    this.tickNo++;
    try {
      for (const p of this.players.values()) {
        for (const input of p.pendingInputs) {
          this.game.applyInput(this.state, p.userId, input.data);
          p.lastSeq = input.seq;
        }
        p.pendingInputs.length = 0;
      }
      const events = this.game.tick(this.state, dt, this.rng);
      const serverTime = Date.now();
      for (const event of events) this.broadcast({ t: 'game.event', tick: this.tickNo, event });
      for (const p of this.players.values()) {
        p.connection?.send({
          t: 'game.state',
          tick: this.tickNo,
          serverTime,
          ackSeq: p.lastSeq,
          state: this.game.snapshot(this.state, p.userId),
        });
      }
      if (this.game.isOver(this.state) || this.activePlayers.length === 0) void this.finish();
    } catch (err) {
      this.log.error({ err, roomId: this.id, gameId: this.game.id }, 'game tick failed; ending room');
      void this.finish();
    }
  }

  private async finish() {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    const results = this.game.results(this.state);
    let finished: FinishedMatch = { matchId: null, results: results.map((r) => ({ ...r, xp: 0 })) };
    try {
      finished = await this.hooks.onFinished(this, results);
    } catch (err) {
      this.log.error({ err, roomId: this.id }, 'failed to record match');
    }
    this.broadcastState();
    this.broadcast({
      t: 'game.end',
      matchId: finished.matchId,
      results: finished.results.map((r) => ({
        userId: r.userId,
        displayName: this.players.get(r.userId)?.displayName ?? 'Unknown',
        score: r.score,
        placement: r.placement,
        xp: r.xp,
      })),
    });
    setTimeout(() => this.dispose(), this.timings.finishedLingerMs).unref();
  }

  /** Socket dropped. In a lobby the player leaves; mid-game they get a grace period. */
  disconnected(conn: Connection): void {
    const p = this.players.get(conn.userId);
    if (!p || p.connection !== conn) return;
    p.connection = null;
    if (this.phase === 'lobby' || this.phase === 'finished') return this.leave(conn.userId, 'disconnected');
    p.graceTimer = setTimeout(() => this.leave(conn.userId, 'disconnect_timeout'), this.timings.reconnectGraceMs);
    this.broadcastState();
  }

  /** Remove a player permanently. */
  leave(userId: string, reason: string): void {
    const p = this.players.get(userId);
    if (!p || p.gone) return;
    if (p.graceTimer) clearTimeout(p.graceTimer);
    p.connection?.send({ t: 'room.left', roomId: this.id, reason });
    p.gone = true;
    p.connection = null;
    if (this.phase === 'lobby' || this.phase === 'countdown') {
      this.players.delete(userId);
    } else if (this.phase === 'playing') {
      this.game.removePlayer(this.state, userId);
    }
    if (this.hostId === userId) this.hostId = this.activePlayers[0]?.userId ?? null;

    if (this.activePlayers.length === 0 && this.phase !== 'playing') {
      this.dispose();
      return;
    }
    if (this.phase === 'countdown' && this.activePlayers.length < (this.mode === 'solo' ? 1 : this.game.minPlayers)) {
      // Not enough players to start: back to the lobby.
      if (this.countdownTimer) clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
      this.phase = 'lobby';
    }
    this.broadcastState();
    this.hooks.onPlayerLeft(this, userId);
  }

  private disposed = false;

  get isDisposed() {
    return this.disposed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.loop) clearInterval(this.loop);
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    for (const p of this.players.values()) if (p.graceTimer) clearTimeout(p.graceTimer);
    this.hooks.onDisposed(this);
  }
}
