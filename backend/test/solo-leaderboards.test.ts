import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, guest, makeApp } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => (app = await makeApp()));
afterAll(async () => app.close());

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function playSolo(auth: Record<string, string>, score: number) {
  const start = await app.inject({ method: 'POST', url: '/v1/solo/sessions', headers: auth, payload: { gameId: 'orb-rush' } });
  expect(start.statusCode).toBe(201);
  await sleep(1_100); // the anti-cheat check rejects runs under one second
  return app.inject({
    method: 'POST',
    url: `/v1/solo/sessions/${start.json().sessionId}/finish`,
    headers: auth,
    payload: { result: { score } },
  });
}

describe('solo runs and leaderboards', () => {
  it('lists the available games', async () => {
    const res = await app.inject({ url: '/v1/games' });
    expect(res.json().games).toEqual([expect.objectContaining({ id: 'orb-rush', modes: ['solo', 'multiplayer'] })]);
  });

  it('records a run, awards XP and ranks players', async () => {
    const players = await Promise.all(['Alpha', 'Bravo', 'Charlie'].map((n) => guest(app, n)));
    const scores = [3, 4, 2];
    const finished = await Promise.all(players.map((p, i) => playSolo(bearer(p.tokens.accessToken), scores[i]!)));
    for (const f of finished) expect(f.statusCode).toBe(200);
    expect(finished[0]!.json().results[0]).toMatchObject({ score: 3, placement: 1, xp: 13 });

    const auth = bearer(players[0]!.tokens.accessToken);
    const top = await app.inject({ url: '/v1/leaderboards/orb-rush/all-time?limit=10', headers: auth });
    expect(top.statusCode).toBe(200);
    const ours = top
      .json()
      .entries.filter((e: { userId: string }) => players.some((p) => p.user.id === e.userId))
      .map((e: { displayName: string; score: number }) => [e.displayName, e.score]);
    expect(ours).toEqual([
      ['Bravo', 4],
      ['Alpha', 3],
      ['Charlie', 2],
    ]);

    const me = await app.inject({ url: '/v1/leaderboards/orb-rush/weekly/me?radius=1', headers: auth });
    expect(me.json().me).toMatchObject({ displayName: 'Alpha', score: 3 });
    expect(me.json().entries.length).toBeGreaterThanOrEqual(2);
    expect(me.json().board).toMatch(/^weekly:\d{4}-W\d{2}$/);

    const profile = await app.inject({ url: '/v1/me', headers: auth });
    expect(profile.json().stats).toMatchObject({ xp: 13, gamesPlayed: 1, wins: 0, losses: 0 });

    const history = await app.inject({ url: '/v1/me/matches', headers: auth });
    expect(history.json().matches[0]).toMatchObject({ gameId: 'orb-rush', mode: 'solo', score: 3 });
  });

  it('keeps only the best score per player', async () => {
    const p = await guest(app);
    const auth = bearer(p.tokens.accessToken);
    await playSolo(auth, 4);
    await playSolo(auth, 1);
    const me = await app.inject({ url: '/v1/leaderboards/orb-rush/all-time/me', headers: auth });
    expect(me.json().me.score).toBe(4);
  });

  it('rejects impossible scores and single-use sessions', async () => {
    const auth = bearer((await guest(app)).tokens.accessToken);
    const cheat = await playSolo(auth, 9_999);
    expect(cheat.statusCode).toBe(422);
    expect(cheat.json().error.code).toBe('result_rejected');

    const start = await app.inject({ method: 'POST', url: '/v1/solo/sessions', headers: auth, payload: { gameId: 'orb-rush' } });
    await sleep(1_100);
    const url = `/v1/solo/sessions/${start.json().sessionId}/finish`;
    expect((await app.inject({ method: 'POST', url, headers: auth, payload: { result: { score: 1 } } })).statusCode).toBe(200);
    expect((await app.inject({ method: 'POST', url, headers: auth, payload: { result: { score: 1 } } })).statusCode).toBe(404);
  });

  it('404s for unknown games', async () => {
    const auth = bearer((await guest(app)).tokens.accessToken);
    expect((await app.inject({ url: '/v1/leaderboards/nope/all-time', headers: auth })).statusCode).toBe(404);
  });
});
