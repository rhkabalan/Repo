import { randomUUID } from 'node:crypto';
import type { GameRegistry } from '../games/registry.js';
import { AppError, badRequest, notFound } from '../lib/errors.js';
import type { Redis } from '../lib/redis.js';
import { parse } from '../lib/validate.js';
import type { MatchRecord, MatchService } from '../matches/service.js';

const SESSION_TTL_SECONDS = 3 * 3600;

interface StoredSession {
  userId: string;
  gameId: string;
  startedAt: number;
}

/**
 * Client-simulated single-player runs (playable offline / with no server tick cost).
 * The server issues a session when the run starts and sanity-checks the result at the end.
 * For cheat-proof solo play, use a real-time solo room instead (see realtime protocol).
 */
export class SoloService {
  constructor(
    private readonly redis: Redis,
    private readonly games: GameRegistry,
    private readonly matches: MatchService,
  ) {}

  async start(userId: string, gameId: string) {
    const game = this.games.get(gameId);
    if (!game.solo) throw badRequest(`${game.name} has no client-simulated solo mode`);
    const sessionId = randomUUID();
    const session: StoredSession = { userId, gameId, startedAt: Date.now() };
    await this.redis.set(`solo:${sessionId}`, JSON.stringify(session), 'EX', SESSION_TTL_SECONDS);
    return { sessionId, gameId, startedAt: new Date(session.startedAt).toISOString() };
  }

  async finish(userId: string, sessionId: string, rawResult: unknown): Promise<MatchRecord> {
    // GETDEL makes each session single-use, even under concurrent submissions.
    const raw = await this.redis.getdel(`solo:${sessionId}`);
    if (!raw) throw notFound('Solo session not found or already finished');
    const session = JSON.parse(raw) as StoredSession;
    if (session.userId !== userId) throw notFound('Solo session not found or already finished');

    const game = this.games.get(session.gameId);
    const result = parse(game.solo!.resultSchema, rawResult);
    const elapsedMs = Date.now() - session.startedAt;
    const score = game.solo!.validate(result, elapsedMs);
    if (score === null) throw new AppError(422, 'result_rejected', 'Result failed validation');

    return this.matches.record(game, 'solo', [{ userId, score, placement: 1 }], new Date(session.startedAt), {
      sessionId,
      elapsedMs,
    });
  }
}
