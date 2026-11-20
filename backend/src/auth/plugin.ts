import type { FastifyReply, FastifyRequest } from 'fastify';
import { unauthorized } from '../lib/errors.js';
import type { AccessClaims, TokenService } from './tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: AccessClaims;
  }
}

/** preHandler that requires `Authorization: Bearer <access token>` and sets `request.auth`. */
export function requireAuth(tokens: TokenService) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    request.auth = await tokens.verifyAccess(header.slice(7));
  };
}
