import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CloseCode } from '../src/realtime/protocol.js';
import { bearer, guest, listen, makeApp, TestClient } from './helpers.js';

let app: FastifyInstance;
let url: string;
beforeAll(async () => {
  app = await makeApp();
  url = await listen(app);
});
afterAll(async () => app.close());

/** Steer toward the nearest orb every snapshot so the game produces real scores. */
function autopilot(client: TestClient, userId: string) {
  let seq = 0;
  client.ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.t !== 'game.state') return;
    const me = m.state.players.find((p: { id: string }) => p.id === userId);
    const orb = m.state.orbs[0];
    if (!me || !orb) return;
    const dx = orb.x - me.x;
    const dy = orb.y - me.y;
    const len = Math.hypot(dx, dy) || 1;
    client.send({ t: 'input', seq: ++seq, data: { dx: dx / len, dy: dy / len } });
  });
}

describe('real-time multiplayer', () => {
  it('rejects unauthenticated sockets', async () => {
    const c = await TestClient.connect(url, 'not-a-token', 'message');
    expect((await c.waitClosed()).code).toBe(CloseCode.AuthFailed);
  });

  it('matchmakes two players and plays a full authoritative match', async () => {
    const [a, b] = await Promise.all([guest(app, 'Ace'), guest(app, 'Blaze')]);
    const ca = await TestClient.connect(url, a.tokens.accessToken, 'header');
    const cb = await TestClient.connect(url, b.tokens.accessToken, 'message'); // browser-style auth
    await Promise.all([ca.waitFor('welcome'), cb.waitFor('welcome')]);
    autopilot(ca, a.user.id);
    autopilot(cb, b.user.id);

    ca.send({ t: 'queue.join', gameId: 'orb-rush' });
    cb.send({ t: 'queue.join', gameId: 'orb-rush' });
    const found = await ca.waitFor('match.found');
    expect((await cb.waitFor('match.found')).roomId).toBe(found.roomId);

    await ca.waitFor('game.countdown');
    await ca.waitFor('game.start');
    const state = await ca.waitFor('game.state');
    expect(state.state.players).toHaveLength(2);
    // Inputs are acknowledged so clients can reconcile prediction.
    await ca.waitFor('game.state', (m) => typeof m.ackSeq === 'number');

    const end = await ca.waitFor('game.end');
    expect(end.matchId).toEqual(expect.any(String));
    expect(end.results).toHaveLength(2);
    expect(end.results.map((r: { displayName: string }) => r.displayName).sort()).toEqual(['Ace', 'Blaze']);
    expect(end.results[0].placement).toBe(1);

    const stats = (await app.inject({ url: '/v1/me', headers: bearer(a.tokens.accessToken) })).json().stats;
    expect(stats.gamesPlayed).toBe(1);
    expect(stats.wins + stats.losses).toBeLessThanOrEqual(1);
    expect(stats.xp).toBeGreaterThan(0);
    ca.close();
    cb.close();
  });

  it('runs private rooms with invite codes, ready checks and chat', async () => {
    const [host, friend] = await Promise.all([guest(app, 'Host'), guest(app, 'Friend')]);
    const ch = await TestClient.connect(url, host.tokens.accessToken);
    const cf = await TestClient.connect(url, friend.tokens.accessToken);
    await Promise.all([ch.waitFor('welcome'), cf.waitFor('welcome')]);

    ch.send({ t: 'room.create', gameId: 'orb-rush' });
    const created = await ch.waitFor('room.state');
    const code = created.room.code as string;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);

    cf.send({ t: 'room.join', code: code.toLowerCase() });
    await ch.waitFor('room.state', (m) => m.room.players.length === 2);

    ch.send({ t: 'room.start' });
    const refused = await ch.waitFor('error');
    expect(refused.code).toBe('cannot_start');

    cf.send({ t: 'chat', text: 'gl hf' });
    expect((await ch.waitFor('chat')).text).toBe('gl hf');

    cf.send({ t: 'room.ready', ready: true });
    await ch.waitFor('room.state', (m) => m.room.players.every((p: { ready: boolean; isHost: boolean }) => p.ready || p.isHost));
    ch.send({ t: 'room.start' });
    await cf.waitFor('game.start');
    await cf.waitFor('game.end');
    ch.close();
    cf.close();
  });

  it('runs an authoritative solo room', async () => {
    const p = await guest(app);
    const c = await TestClient.connect(url, p.tokens.accessToken);
    await c.waitFor('welcome');
    autopilot(c, p.user.id);
    c.send({ t: 'room.create', gameId: 'orb-rush', mode: 'solo' });
    await c.waitFor('game.start');
    const end = await c.waitFor('game.end');
    expect(end.results).toEqual([expect.objectContaining({ userId: p.user.id, placement: 1 })]);
    c.close();
  });

  it('lets a player reconnect into a running match', async () => {
    const [a, b] = await Promise.all([guest(app), guest(app)]);
    const ca = await TestClient.connect(url, a.tokens.accessToken);
    const cb = await TestClient.connect(url, b.tokens.accessToken);
    await Promise.all([ca.waitFor('welcome'), cb.waitFor('welcome')]);
    ca.send({ t: 'queue.join', gameId: 'orb-rush' });
    cb.send({ t: 'queue.join', gameId: 'orb-rush' });
    await ca.waitFor('game.start');

    ca.close(); // e.g. phone switched from Wi-Fi to cellular
    await cb.waitFor('room.state', (m) => m.room.players.some((p: { connected: boolean }) => !p.connected));

    const again = await TestClient.connect(url, a.tokens.accessToken);
    await again.waitFor('welcome');
    expect((await again.waitFor('room.state')).room.phase).toBe('playing');
    await again.waitFor('game.state');
    await again.waitFor('game.end');
    again.close();
    cb.close();
  });

  it('replaces an older socket when the same player connects twice', async () => {
    const p = await guest(app);
    const first = await TestClient.connect(url, p.tokens.accessToken);
    await first.waitFor('welcome');
    const second = await TestClient.connect(url, p.tokens.accessToken);
    await second.waitFor('welcome');
    expect((await first.waitClosed()).code).toBe(CloseCode.Replaced);
    second.close();
  });

  it('reports protocol errors without dropping the connection', async () => {
    const p = await guest(app);
    const c = await TestClient.connect(url, p.tokens.accessToken);
    await c.waitFor('welcome');
    c.ws.send('not json');
    expect((await c.waitFor('error')).code).toBe('bad_message');
    c.send({ t: 'room.join', code: 'ZZZZZZ' });
    expect((await c.waitFor('error', (m) => m.code === 'room_not_found')).code).toBe('room_not_found');
    c.send({ t: 'ping', ts: 42 });
    expect((await c.waitFor('pong')).ts).toBe(42);
    c.close();
  });
});
