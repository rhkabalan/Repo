import type { FastifyBaseLogger } from 'fastify';
import type { AnyGameDefinition, GameMode } from '../games/types.js';
import type { MatchService } from '../matches/service.js';
import type { Connection } from './connection.js';
import { Room, randomRoomCode, type RoomTimings } from './room.js';

/** Owns every live room on this server and the indexes to find them. */
export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly byCode = new Map<string, Room>();
  private readonly byUser = new Map<string, Room>();

  constructor(
    private readonly matches: MatchService,
    private readonly timings: RoomTimings,
    private readonly log: FastifyBaseLogger,
  ) {}

  get size() {
    return this.rooms.size;
  }

  create(game: AnyGameDefinition, mode: GameMode, withInviteCode: boolean): Room {
    let code: string | null = null;
    if (withInviteCode) {
      do code = randomRoomCode();
      while (this.byCode.has(code));
    }
    const room = new Room(
      game,
      mode,
      code,
      this.timings,
      {
        onFinished: async (r, results) => {
          if (!r.startedAt) return { matchId: null, results: results.map((x) => ({ ...x, xp: 0 })) };
          return this.matches.record(r.game, r.mode, results, r.startedAt, { roomId: r.id });
        },
        onPlayerLeft: (r, userId) => {
          if (this.byUser.get(userId) === r) this.byUser.delete(userId);
        },
        onDisposed: (r) => {
          this.rooms.delete(r.id);
          if (r.code) this.byCode.delete(r.code);
          for (const userId of r.players.keys()) if (this.byUser.get(userId) === r) this.byUser.delete(userId);
        },
      },
      this.log,
    );
    this.rooms.set(room.id, room);
    if (code) this.byCode.set(code, room);
    return room;
  }

  addPlayer(room: Room, conn: Connection): void {
    room.addPlayer(conn);
    this.byUser.set(conn.userId, room);
  }

  byInviteCode(code: string): Room | undefined {
    return this.byCode.get(code.toUpperCase());
  }

  roomOf(userId: string): Room | undefined {
    const room = this.byUser.get(userId);
    return room && !room.isDisposed ? room : undefined;
  }

  shutdown(): void {
    for (const room of [...this.rooms.values()]) room.dispose();
  }
}
