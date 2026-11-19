import type { FastifyInstance } from 'fastify';
import { parse } from '../lib/validate.js';
import type { Services } from '../server.js';
import { catalog } from './content/catalog.js';
import { journeyEventSchema } from './engine.js';
import { localize, pickLang } from './localize.js';

export async function journeyRoutes(app: FastifyInstance, { journey, requireAuth }: Services) {
  // Public: the bilingual content catalog (puzzle solutions and editor notes are stripped).
  app.get('/v1/journey/content', async (req, reply) => {
    const lang = pickLang(req.query, req.headers['accept-language']);
    reply.header('cache-control', 'public, max-age=300');
    return { lang, ...(localize(catalog, lang) as object) };
  });

  app.get('/v1/journey', { preHandler: requireAuth }, async (req) => {
    return journey.get(req.auth.userId, pickLang(req.query, req.headers['accept-language']));
  });

  app.post('/v1/journey/events', { preHandler: requireAuth }, async (req) => {
    const event = parse(journeyEventSchema, req.body);
    return journey.apply(req.auth.userId, event, pickLang(req.query, req.headers['accept-language']));
  });
}
