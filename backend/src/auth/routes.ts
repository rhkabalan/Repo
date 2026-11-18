import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { displayNameSchema } from '../lib/schemas.js';
import { parse } from '../lib/validate.js';
import type { Services } from '../server.js';

export async function authRoutes(app: FastifyInstance, { auth, tokens, requireAuth, config }: Services) {
  const authRateLimit = { config: { rateLimit: { max: config.AUTH_RATE_LIMIT_PER_MINUTE, timeWindow: '1 minute' } } };

  app.post('/v1/auth/guest', authRateLimit, async (req, reply) => {
    const body = parse(z.object({ displayName: displayNameSchema.optional() }), req.body ?? {});
    reply.code(201);
    return auth.signInAsGuest(body.displayName);
  });

  app.post('/v1/auth/google', authRateLimit, async (req) => {
    const { idToken } = parse(z.object({ idToken: z.string().min(1) }), req.body);
    return auth.signInWithGoogle(idToken);
  });

  app.post('/v1/auth/refresh', authRateLimit, async (req) => {
    const { refreshToken } = parse(z.object({ refreshToken: z.string().min(1) }), req.body);
    const { tokens: pair } = await tokens.rotate(refreshToken);
    return { tokens: pair };
  });

  app.post('/v1/auth/logout', async (req, reply) => {
    const { refreshToken } = parse(z.object({ refreshToken: z.string().min(1) }), req.body);
    await tokens.revokeFamily(refreshToken);
    reply.code(204);
  });

  app.post('/v1/auth/link/google', { ...authRateLimit, preHandler: requireAuth }, async (req) => {
    const { idToken } = parse(z.object({ idToken: z.string().min(1) }), req.body);
    return auth.linkGoogle(req.auth.userId, idToken);
  });
}
