import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { displayNameSchema, uuidSchema } from '../lib/schemas.js';
import { parse } from '../lib/validate.js';
import type { Services } from '../server.js';
import { getStats, getUser, updateUser } from './service.js';

export async function userRoutes(app: FastifyInstance, { db, requireAuth }: Services) {
  app.get('/v1/me', { preHandler: requireAuth }, async (req) => {
    const [user, stats] = await Promise.all([getUser(db, req.auth.userId), getStats(db, req.auth.userId)]);
    return { user, stats };
  });

  app.patch('/v1/me', { preHandler: requireAuth }, async (req) => {
    const body = parse(
      z.object({
        displayName: displayNameSchema.optional(),
        avatarUrl: z.string().url().max(512).startsWith('https://').nullable().optional(),
      }),
      req.body,
    );
    return { user: await updateUser(db, req.auth.userId, body) };
  });

  app.get('/v1/me/matches', { preHandler: requireAuth }, async (req) => {
    const { limit } = parse(z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }), req.query);
    const { rows } = await db.query<{
      id: string;
      game_id: string;
      mode: string;
      started_at: Date;
      ended_at: Date | null;
      score: number;
      placement: number | null;
      player_count: number;
    }>(
      `SELECT m.id, m.game_id, m.mode, m.started_at, m.ended_at, mp.score, mp.placement,
              (SELECT count(*)::int FROM match_players x WHERE x.match_id = m.id) AS player_count
         FROM match_players mp JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = $1
        ORDER BY m.started_at DESC LIMIT $2`,
      [req.auth.userId, limit],
    );
    return {
      matches: rows.map((r) => ({
        matchId: r.id,
        gameId: r.game_id,
        mode: r.mode,
        startedAt: r.started_at.toISOString(),
        endedAt: r.ended_at?.toISOString() ?? null,
        score: r.score,
        placement: r.placement,
        playerCount: r.player_count,
      })),
    };
  });

  app.get('/v1/users/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = parse(z.object({ id: uuidSchema }), req.params);
    const [user, stats] = await Promise.all([getUser(db, id), getStats(db, id)]);
    return { user: { id: user.id, displayName: user.displayName, avatarUrl: user.avatarUrl }, stats };
  });
}
