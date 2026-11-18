import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import type { AnyGameDefinition, GameMode, PlayerResult } from '../games/types.js';
import type { LeaderboardService } from '../leaderboards/service.js';
import { recordGameStats } from '../users/service.js';

export interface RecordedResult extends PlayerResult {
  xp: number;
}

export interface MatchRecord {
  matchId: string;
  results: RecordedResult[];
}

/** Persists a finished game: match history, per-player stats/XP, and leaderboard scores. */
export class MatchService {
  constructor(
    private readonly db: Db,
    private readonly leaderboards: LeaderboardService,
  ) {}

  async record(
    game: AnyGameDefinition,
    mode: GameMode,
    results: PlayerResult[],
    startedAt: Date,
    extra: Record<string, unknown> = {},
  ): Promise<MatchRecord> {
    const playerCount = results.length;
    const recorded = results.map((r) => ({ ...r, xp: Math.max(0, Math.round(game.xpFor(r, playerCount))) }));
    const competitive = mode === 'multiplayer' && playerCount > 1;

    const matchId = await withTransaction(this.db, async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO matches (game_id, mode, status, started_at, ended_at, result)
         VALUES ($1, $2, 'finished', $3, now(), $4::jsonb) RETURNING id`,
        [game.id, mode, startedAt, JSON.stringify({ results: recorded, ...extra })],
      );
      const id = rows[0]!.id;
      for (const r of recorded) {
        await client.query(
          'INSERT INTO match_players (match_id, user_id, score, placement) VALUES ($1, $2, $3, $4)',
          [id, r.userId, r.score, r.placement],
        );
        await recordGameStats(client, r.userId, {
          xp: r.xp,
          won: competitive && r.placement === 1,
          lost: competitive && r.placement > 1,
        });
        await this.leaderboards.submit(client, game.id, r.userId, r.score);
      }
      return id;
    });

    await Promise.all(recorded.map((r) => this.leaderboards.publish(game.id, r.userId, r.score)));
    return { matchId, results: recorded };
  }
}
