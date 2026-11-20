import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { badRequest } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import type { Services } from '../server.js';

const MAX_SAVE_BYTES = 256 * 1024;
const slotParams = z.object({ slot: z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/, 'Invalid slot name') });

export async function saveRoutes(app: FastifyInstance, { saves, requireAuth }: Services) {
  app.get('/v1/saves', { preHandler: requireAuth }, async (req) => ({ slots: await saves.list(req.auth.userId) }));

  app.get('/v1/saves/:slot', { preHandler: requireAuth }, async (req) => {
    const { slot } = parse(slotParams, req.params);
    return saves.get(req.auth.userId, slot);
  });

  app.put('/v1/saves/:slot', { preHandler: requireAuth, bodyLimit: MAX_SAVE_BYTES + 1024 }, async (req) => {
    const { slot } = parse(slotParams, req.params);
    const body = parse(
      z.object({ data: z.unknown(), expectedVersion: z.number().int().min(0).optional() }),
      req.body,
    );
    if (body.data === undefined) throw badRequest('data is required');
    if (Buffer.byteLength(JSON.stringify(body.data)) > MAX_SAVE_BYTES) {
      throw badRequest(`Save data must be at most ${MAX_SAVE_BYTES / 1024} KB`);
    }
    return saves.put(req.auth.userId, slot, body.data, body.expectedVersion);
  });

  app.delete('/v1/saves/:slot', { preHandler: requireAuth }, async (req, reply) => {
    const { slot } = parse(slotParams, req.params);
    await saves.delete(req.auth.userId, slot);
    reply.code(204);
  });
}
