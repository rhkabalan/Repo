import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Fastify, { type FastifyInstance, type preHandlerAsyncHookHandler } from 'fastify';
import { createGoogleVerifier, type GoogleVerifier } from './auth/google.js';
import { requireAuth } from './auth/plugin.js';
import { authRoutes } from './auth/routes.js';
import { AuthService } from './auth/service.js';
import { TokenService } from './auth/tokens.js';
import type { Config } from './config.js';
import { migrate } from './db/migrate.js';
import { createPool, type Db } from './db/pool.js';
import { GameRegistry, defaultGames } from './games/registry.js';
import type { AnyGameDefinition } from './games/types.js';
import { leaderboardRoutes } from './leaderboards/routes.js';
import { LeaderboardService } from './leaderboards/service.js';
import { AppError } from './lib/errors.js';
import { createRedis, type Redis } from './lib/redis.js';
import { MatchService } from './matches/service.js';
import { RealtimeHub } from './realtime/hub.js';
import { Matchmaker, type MatchmakerOptions } from './realtime/matchmaker.js';
import type { RoomTimings } from './realtime/room.js';
import { RoomManager } from './realtime/rooms.js';
import { saveRoutes } from './saves/routes.js';
import { SaveService } from './saves/service.js';
import { soloRoutes } from './solo/routes.js';
import { SoloService } from './solo/service.js';
import { userRoutes } from './users/routes.js';

export interface Services {
  config: Config;
  db: Db;
  redis: Redis;
  games: GameRegistry;
  tokens: TokenService;
  auth: AuthService;
  saves: SaveService;
  leaderboards: LeaderboardService;
  matches: MatchService;
  solo: SoloService;
  rooms: RoomManager;
  matchmaker: Matchmaker;
  hub: RealtimeHub;
  requireAuth: preHandlerAsyncHookHandler;
}

export interface BuildOptions {
  googleVerifier?: GoogleVerifier;
  games?: AnyGameDefinition[];
  roomTimings?: Partial<RoomTimings>;
  matchmaker?: Partial<MatchmakerOptions>;
  runMigrations?: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    services: Services;
  }
}

export async function buildApp(config: Config, opts: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      config.NODE_ENV === 'development'
        ? { level: config.LOG_LEVEL, transport: { target: 'pino-pretty' } }
        : { level: config.LOG_LEVEL },
    trustProxy: true,
    bodyLimit: 64 * 1024,
    disableRequestLogging: config.NODE_ENV === 'test',
  });

  const db = createPool(config.DATABASE_URL);
  const redis = createRedis(config.REDIS_URL);
  if (opts.runMigrations ?? true) await migrate(db, (m) => app.log.info(m));

  const games = new GameRegistry(opts.games ?? defaultGames());
  const tokens = new TokenService(db, config.JWT_SECRET, config.ACCESS_TOKEN_TTL_SECONDS, config.REFRESH_TOKEN_TTL_DAYS);
  const leaderboards = new LeaderboardService(db, redis);
  const matches = new MatchService(db, leaderboards);
  const rooms = new RoomManager(
    matches,
    { countdownMs: 3_000, reconnectGraceMs: 20_000, finishedLingerMs: 10_000, ...opts.roomTimings },
    app.log,
  );
  const matchmaker = new Matchmaker(games, rooms, { fillWaitMs: 5_000, intervalMs: 500, ...opts.matchmaker });
  const services: Services = {
    config,
    db,
    redis,
    games,
    tokens,
    auth: new AuthService(db, tokens, opts.googleVerifier ?? createGoogleVerifier(config.GOOGLE_CLIENT_IDS)),
    saves: new SaveService(db),
    leaderboards,
    matches,
    solo: new SoloService(redis, games, matches),
    rooms,
    matchmaker,
    hub: new RealtimeHub(db, tokens, games, rooms, matchmaker, app.log),
    requireAuth: requireAuth(tokens),
  };
  app.decorate('services', services);

  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: config.CORS_ORIGINS.length === 0 || config.CORS_ORIGINS.includes('*') ? true : config.CORS_ORIGINS,
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    redis,
    nameSpace: 'rl:',
    errorResponseBuilder: (_req, ctx) =>
      new AppError(429, 'rate_limited', `Too many requests, retry in ${Math.ceil(ctx.ttl / 1000)}s`),
  });
  await app.register(websocket, { options: { maxPayload: 16 * 1024 } });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
    }
    const status = (err as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      return reply.code(status).send({ error: { code: 'bad_request', message: (err as Error).message } });
    }
    req.log.error({ err }, 'unhandled error');
    return reply.code(500).send({ error: { code: 'internal', message: 'Internal server error' } });
  });
  app.setNotFoundHandler((_req, reply) =>
    reply.code(404).send({ error: { code: 'not_found', message: 'Route not found' } }),
  );

  app.get('/health', { config: { rateLimit: false } }, async () => ({ status: 'ok' }));
  app.get('/ready', { config: { rateLimit: false } }, async (_req, reply) => {
    try {
      await Promise.all([db.query('SELECT 1'), redis.ping()]);
      return { status: 'ready', rooms: rooms.size, online: services.hub.onlineCount };
    } catch {
      return reply.code(503).send({ status: 'unavailable' });
    }
  });

  app.get('/v1/games', async () => ({
    games: games.list().map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      modes: g.modes,
      minPlayers: g.minPlayers,
      maxPlayers: g.maxPlayers,
      tickRate: g.tickRate,
      clientSimulatedSolo: Boolean(g.solo),
    })),
  }));

  app.get('/v1/realtime', { websocket: true, config: { rateLimit: false } }, (socket, req) =>
    services.hub.handle(socket, req),
  );

  await app.register(async (scope) => {
    await authRoutes(scope, services);
    await userRoutes(scope, services);
    await saveRoutes(scope, services);
    await leaderboardRoutes(scope, services);
    await soloRoutes(scope, services);
  });

  app.addHook('onClose', async () => {
    services.matchmaker.stop();
    services.hub.shutdown();
    services.rooms.shutdown();
    await Promise.allSettled([db.end(), redis.quit()]);
  });

  return app;
}
