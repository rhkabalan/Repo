import type { Db, Queryable } from '../db/pool.js';
import type { Redis } from '../lib/redis.js';
import { getUsers } from '../users/service.js';

export const PERIODS = ['all-time', 'weekly', 'daily'] as const;
export type Period = (typeof PERIODS)[number];

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
}

/** ISO-8601 week id, e.g. 2026-W47. */
function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** The concrete board id for a period at a given time: "all-time", "weekly:2026-W47", "daily:2026-11-18". */
export function boardId(period: Period, now = new Date()): string {
  if (period === 'weekly') return `weekly:${isoWeek(now)}`;
  if (period === 'daily') return `daily:${now.toISOString().slice(0, 10)}`;
  return 'all-time';
}

const PERIOD_TTL_SECONDS: Record<Period, number | null> = {
  'all-time': null,
  weekly: 15 * 86_400,
  daily: 3 * 86_400,
};

/**
 * Best-score leaderboards. Postgres is the source of truth; Redis sorted sets give
 * O(log n) ranks and are rebuilt from Postgres automatically if Redis loses them.
 */
export class LeaderboardService {
  constructor(
    private readonly db: Db,
    private readonly redis: Redis,
  ) {}

  private key(gameId: string, board: string) {
    return `lb:${gameId}:${board}`;
  }

  /** Record a score on every period board, keeping each player's best. */
  async submit(db: Queryable, gameId: string, userId: string, score: number, now = new Date()): Promise<void> {
    for (const period of PERIODS) {
      const board = boardId(period, now);
      await db.query(
        `INSERT INTO leaderboard_entries (game_id, board, user_id, best_score) VALUES ($1, $2, $3, $4)
         ON CONFLICT (game_id, board, user_id) DO UPDATE
           SET best_score = GREATEST(leaderboard_entries.best_score, EXCLUDED.best_score),
               updated_at = CASE WHEN EXCLUDED.best_score > leaderboard_entries.best_score
                                 THEN now() ELSE leaderboard_entries.updated_at END`,
        [gameId, board, userId, score],
      );
    }
  }

  /** Mirror scores into Redis. Call after the database transaction has committed. */
  async publish(gameId: string, userId: string, score: number, now = new Date()): Promise<void> {
    const pipeline = this.redis.pipeline();
    for (const period of PERIODS) {
      const key = this.key(gameId, boardId(period, now));
      pipeline.zadd(key, 'GT', score, userId);
      const ttl = PERIOD_TTL_SECONDS[period];
      if (ttl) pipeline.expire(key, ttl);
    }
    await pipeline.exec();
  }

  private async ensureLoaded(gameId: string, board: string): Promise<string> {
    const key = this.key(gameId, board);
    if (await this.redis.exists(key)) return key;
    const { rows } = await this.db.query<{ user_id: string; best_score: number }>(
      'SELECT user_id, best_score FROM leaderboard_entries WHERE game_id = $1 AND board = $2',
      [gameId, board],
    );
    if (rows.length > 0) {
      const args = rows.flatMap((r) => [r.best_score, r.user_id]);
      await this.redis.zadd(key, 'GT', ...args);
    }
    return key;
  }

  private async hydrate(pairs: string[], firstRank: number): Promise<LeaderboardEntry[]> {
    const ids: string[] = [];
    const scores: number[] = [];
    for (let i = 0; i < pairs.length; i += 2) {
      ids.push(pairs[i]!);
      scores.push(Number(pairs[i + 1]));
    }
    const users = await getUsers(this.db, ids);
    return ids.map((id, i) => ({
      rank: firstRank + i,
      userId: id,
      displayName: users.get(id)?.displayName ?? 'Unknown',
      avatarUrl: users.get(id)?.avatarUrl ?? null,
      score: scores[i]!,
    }));
  }

  async top(gameId: string, period: Period, limit: number, offset: number) {
    const board = boardId(period);
    const key = await this.ensureLoaded(gameId, board);
    const [pairs, total] = await Promise.all([
      this.redis.zrevrange(key, offset, offset + limit - 1, 'WITHSCORES'),
      this.redis.zcard(key),
    ]);
    return { board, total, entries: await this.hydrate(pairs, offset + 1) };
  }

  /** The player's own rank plus `radius` neighbours above and below. */
  async around(gameId: string, period: Period, userId: string, radius: number) {
    const board = boardId(period);
    const key = await this.ensureLoaded(gameId, board);
    const rank = await this.redis.zrevrank(key, userId);
    if (rank === null) return { board, me: null, entries: [] as LeaderboardEntry[] };
    const start = Math.max(0, rank - radius);
    const pairs = await this.redis.zrevrange(key, start, rank + radius, 'WITHSCORES');
    const entries = await this.hydrate(pairs, start + 1);
    return { board, me: entries.find((e) => e.userId === userId) ?? null, entries };
  }
}
