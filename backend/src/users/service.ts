import { randomInt } from 'node:crypto';
import type { Queryable } from '../db/pool.js';
import { notFound } from '../lib/errors.js';

/** The playable characters (designs in art/concepts). */
export const CHARACTER_IDS = ['traveler', 'steadfast', 'elder'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
  /** null until the player has chosen a character. */
  characterId: CharacterId | null;
  createdAt: string;
}

export interface PlayerStats {
  xp: number;
  level: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

interface UserRow {
  id: string;
  display_name: string;
  avatar_url: string | null;
  is_guest: boolean;
  character_id: CharacterId | null;
  created_at: Date;
}

const toUser = (r: UserRow): User => ({
  id: r.id,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  isGuest: r.is_guest,
  characterId: r.character_id,
  createdAt: r.created_at.toISOString(),
});

const USER_COLUMNS = 'id, display_name, avatar_url, is_guest, character_id, created_at';

export const randomGuestName = () => `Player${randomInt(1000, 10000)}`;

import { levelForXp } from '../lib/levels.js';
export { levelForXp };

export async function createUser(
  db: Queryable,
  input: { displayName: string; avatarUrl?: string | null; isGuest: boolean },
): Promise<User> {
  const { rows } = await db.query<UserRow>(
    `INSERT INTO users (display_name, avatar_url, is_guest) VALUES ($1, $2, $3) RETURNING ${USER_COLUMNS}`,
    [input.displayName, input.avatarUrl ?? null, input.isGuest],
  );
  await db.query('INSERT INTO player_stats (user_id) VALUES ($1)', [rows[0]!.id]);
  return toUser(rows[0]!);
}

export async function getUser(db: Queryable, id: string): Promise<User> {
  const { rows } = await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  if (!rows[0]) throw notFound('User not found');
  return toUser(rows[0]);
}

export async function getUsers(db: Queryable, ids: string[]): Promise<Map<string, User>> {
  if (ids.length === 0) return new Map();
  const { rows } = await db.query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = ANY($1::uuid[])`, [
    ids,
  ]);
  return new Map(rows.map((r) => [r.id, toUser(r)]));
}

export async function updateUser(
  db: Queryable,
  id: string,
  patch: { displayName?: string; avatarUrl?: string | null; characterId?: CharacterId },
): Promise<User> {
  const { rows } = await db.query<UserRow>(
    `UPDATE users SET
        display_name = COALESCE($2, display_name),
        avatar_url   = CASE WHEN $3::boolean THEN $4 ELSE avatar_url END,
        character_id = COALESCE($5, character_id),
        updated_at   = now()
      WHERE id = $1 RETURNING ${USER_COLUMNS}`,
    [id, patch.displayName ?? null, patch.avatarUrl !== undefined, patch.avatarUrl ?? null, patch.characterId ?? null],
  );
  if (!rows[0]) throw notFound('User not found');
  return toUser(rows[0]);
}

export async function getStats(db: Queryable, userId: string): Promise<PlayerStats> {
  const { rows } = await db.query<{ xp: number; games_played: number; wins: number; losses: number }>(
    'SELECT xp, games_played, wins, losses FROM player_stats WHERE user_id = $1',
    [userId],
  );
  const r = rows[0] ?? { xp: 0, games_played: 0, wins: 0, losses: 0 };
  return { xp: r.xp, level: levelForXp(r.xp), gamesPlayed: r.games_played, wins: r.wins, losses: r.losses };
}

export async function recordGameStats(
  db: Queryable,
  userId: string,
  delta: { xp: number; won: boolean; lost: boolean },
): Promise<void> {
  await db.query(
    `UPDATE player_stats SET
        xp = xp + $2, games_played = games_played + 1,
        wins = wins + $3, losses = losses + $4, updated_at = now()
      WHERE user_id = $1`,
    [userId, Math.max(0, Math.round(delta.xp)), delta.won ? 1 : 0, delta.lost ? 1 : 0],
  );
}
