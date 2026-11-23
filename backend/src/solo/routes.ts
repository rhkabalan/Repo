import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { uuidSchema } from '../lib/schemas.js';
import { parse } from '../lib/validate.js';
import type { Services } from '../server.js';

export async function soloRoutes(app: FastifyInstance, { solo, requireAuth }: Services) {
  app.post('/v1/solo/sessions', { preHandler: requireAuth }, async (req, reply) => {
    const { gameId } = parse(z.object({ gameId: z.string().min(1).max(64) }), req.body);
    reply.code(201);
    return solo.start(req.auth.userId, gameId);
  });

  app.post('/v1/solo/sessions/:id/finish', { preHandler: requireAuth }, async (req) => {
    const { id } = parse(z.object({ id: uuidSchema }), req.params);
    const { result } = parse(z.object({ result: z.unknown() }), req.body);
    return solo.finish(req.auth.userId, id, result);
  });
}
