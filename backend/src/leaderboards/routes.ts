import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parse } from '../lib/validate.js';
import type { Services } from '../server.js';
import { PERIODS } from './service.js';

const params = z.object({ gameId: z.string().min(1).max(64), period: z.enum(PERIODS) });

export async function leaderboardRoutes(app: FastifyInstance, { leaderboards, games, requireAuth }: Services) {
  app.get('/v1/leaderboards/:gameId/:period', { preHandler: requireAuth }, async (req) => {
    const { gameId, period } = parse(params, req.params);
    games.get(gameId);
    const q = parse(
      z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        offset: z.coerce.number().int().min(0).max(10_000).default(0),
      }),
      req.query,
    );
    return leaderboards.top(gameId, period, q.limit, q.offset);
  });

  app.get('/v1/leaderboards/:gameId/:period/me', { preHandler: requireAuth }, async (req) => {
    const { gameId, period } = parse(params, req.params);
    games.get(gameId);
    const { radius } = parse(z.object({ radius: z.coerce.number().int().min(0).max(25).default(5) }), req.query);
    return leaderboards.around(gameId, period, req.auth.userId, radius);
  });
}
