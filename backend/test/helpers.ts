import type { AddressInfo } from 'node:net';
import type { FastifyInstance } from 'fastify';
import WebSocket from 'ws';
import type { GoogleVerifier } from '../src/auth/google.js';
import { loadConfig } from '../src/config.js';
import { createOrbRush } from '../src/games/orb-rush/index.js';
import { unauthorized } from '../src/lib/errors.js';
import { buildApp } from '../src/server.js';
import { TEST_DATABASE_URL, TEST_REDIS_URL } from './env.js';

/** Fake Google: accepts tokens shaped "google:<subject>:<name>". */
export const fakeGoogle: GoogleVerifier = async (idToken) => {
  const [prefix, subject, name] = idToken.split(':');
  if (prefix !== 'google' || !subject) throw unauthorized('Invalid Google ID token');
  return { subject, name, email: `${subject}@example.com`, emailVerified: true };
};

export async function makeApp(): Promise<FastifyInstance> {
  const config = loadConfig({
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: TEST_DATABASE_URL,
    REDIS_URL: TEST_REDIS_URL,
    JWT_SECRET: 'test-secret-test-secret-test-secret-1234',
    AUTH_RATE_LIMIT_PER_MINUTE: '10000',
  });
  const app = await buildApp(config, {
    googleVerifier: fakeGoogle,
    games: [createOrbRush({ roundMs: 700 })],
    roomTimings: { countdownMs: 100, reconnectGraceMs: 1_000, finishedLingerMs: 300 },
    matchmaker: { fillWaitMs: 150, intervalMs: 50 },
  });
  await app.ready();
  return app;
}

export async function guest(app: FastifyInstance, displayName?: string) {
  const res = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: displayName ? { displayName } : {} });
  if (res.statusCode !== 201) throw new Error(`guest sign-in failed: ${res.body}`);
  return res.json() as {
    user: { id: string; displayName: string; isGuest: boolean };
    tokens: { accessToken: string; refreshToken: string };
  };
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export async function listen(app: FastifyInstance): Promise<string> {
  await app.listen({ host: '127.0.0.1', port: 0 });
  const { port } = app.server.address() as AddressInfo;
  return `ws://127.0.0.1:${port}/v1/realtime`;
}

type Msg = { t: string; [k: string]: any };

/** Minimal game client that records every server frame and lets tests await specific ones. */
export class TestClient {
  readonly messages: Msg[] = [];
  private waiters: { pred: (m: Msg) => boolean; resolve: (m: Msg) => void }[] = [];
  closed: { code: number; reason: string } | null = null;

  private constructor(readonly ws: WebSocket) {
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as Msg;
      this.messages.push(msg);
      this.waiters = this.waiters.filter((w) => {
        if (!w.pred(msg)) return true;
        w.resolve(msg);
        return false;
      });
    });
    ws.on('close', (code, reason) => (this.closed = { code, reason: reason.toString() }));
  }

  static async connect(url: string, token: string, via: 'header' | 'message' = 'header') {
    const ws = new WebSocket(url, via === 'header' ? { headers: bearer(token) } : {});
    const client = new TestClient(ws);
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });
    if (via === 'message') client.send({ t: 'auth', token });
    return client;
  }

  send(msg: object) {
    this.ws.send(JSON.stringify(msg));
  }

  /** Resolve with the first frame (already received or future) matching type/predicate. */
  waitFor(t: string, pred: (m: Msg) => boolean = () => true, timeoutMs = 5_000, fromIndex = 0): Promise<Msg> {
    const match = (m: Msg) => m.t === t && pred(m);
    const existing = this.messages.slice(fromIndex).find(match);
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out waiting for ${t}`)), timeoutMs);
      this.waiters.push({
        pred: match,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      });
    });
  }

  waitClosed(timeoutMs = 3_000): Promise<{ code: number; reason: string }> {
    if (this.closed) return Promise.resolve(this.closed);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for close')), timeoutMs);
      this.ws.once('close', (code, reason) => {
        clearTimeout(timer);
        resolve({ code, reason: reason.toString() });
      });
    });
  }

  close() {
    this.ws.close();
  }
}
