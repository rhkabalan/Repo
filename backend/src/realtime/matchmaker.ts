import type { GameRegistry } from '../games/registry.js';
import type { Connection } from './connection.js';
import type { RoomManager } from './rooms.js';

interface Ticket {
  conn: Connection;
  joinedAt: number;
}

export interface MatchmakerOptions {
  /** Once the minimum is met, wait this long for more players before starting. */
  fillWaitMs: number;
  intervalMs: number;
}

/**
 * Quick-match queue per game. Fills rooms up to the game's max players; once the minimum
 * is reached it waits `fillWaitMs` for more before starting.
 *
 * Skill-based matching (by level/rating) can be layered on later by bucketing tickets.
 */
export class Matchmaker {
  private readonly queues = new Map<string, Ticket[]>();
  private readonly userQueue = new Map<string, string>();
  private readonly timer: NodeJS.Timeout;

  constructor(
    private readonly games: GameRegistry,
    private readonly rooms: RoomManager,
    private readonly opts: MatchmakerOptions,
  ) {
    this.timer = setInterval(() => this.tick(), opts.intervalMs);
    this.timer.unref();
  }

  /** Returns the player's 1-based queue position. */
  join(conn: Connection, gameId: string): number {
    this.leave(conn.userId);
    const queue = this.queues.get(gameId) ?? [];
    queue.push({ conn, joinedAt: Date.now() });
    this.queues.set(gameId, queue);
    this.userQueue.set(conn.userId, gameId);
    return queue.length;
  }

  leave(userId: string): boolean {
    const gameId = this.userQueue.get(userId);
    if (!gameId) return false;
    this.userQueue.delete(userId);
    const queue = this.queues.get(gameId);
    if (queue) this.queues.set(gameId, queue.filter((t) => t.conn.userId !== userId));
    return true;
  }

  isQueued(userId: string) {
    return this.userQueue.has(userId);
  }

  tick(now = Date.now()): void {
    for (const [gameId, rawQueue] of this.queues) {
      const game = this.games.get(gameId);
      // Drop tickets whose sockets died.
      const queue = rawQueue.filter((t) => t.conn.open);
      for (const t of rawQueue) if (!t.conn.open) this.userQueue.delete(t.conn.userId);

      const min = Math.max(2, game.minPlayers);
      const max = game.maxPlayers;
      while (queue.length >= min) {
        const full = queue.length >= max;
        const waitedLongEnough = now - queue[0]!.joinedAt >= this.opts.fillWaitMs;
        if (!full && !waitedLongEnough) break;
        const group = queue.splice(0, Math.min(max, queue.length));
        const room = this.rooms.create(game, 'multiplayer', false);
        for (const t of group) {
          this.userQueue.delete(t.conn.userId);
          this.rooms.addPlayer(room, t.conn);
          t.conn.send({ t: 'match.found', roomId: room.id, gameId });
        }
        room.start();
      }
      this.queues.set(gameId, queue);
    }
  }

  stop(): void {
    clearInterval(this.timer);
  }
}
