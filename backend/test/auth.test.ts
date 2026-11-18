import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, guest, makeApp } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => (app = await makeApp()));
afterAll(async () => app.close());

describe('guest accounts', () => {
  it('creates a guest with a generated name and returns usable tokens', async () => {
    const { user, tokens } = await guest(app);
    expect(user.isGuest).toBe(true);
    expect(user.displayName).toMatch(/^Player\d{4}$/);

    const me = await app.inject({ url: '/v1/me', headers: bearer(tokens.accessToken) });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ user: { id: user.id }, stats: { level: 1, xp: 0, gamesPlayed: 0 } });
  });

  it('validates display names', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: { displayName: 'x' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('bad_request');
  });

  it('rejects missing or forged access tokens', async () => {
    expect((await app.inject({ url: '/v1/me' })).statusCode).toBe(401);
    expect((await app.inject({ url: '/v1/me', headers: bearer('nope') })).statusCode).toBe(401);
  });

  it('lets a player rename themselves', async () => {
    const { tokens } = await guest(app);
    const res = await app.inject({
      method: 'PATCH',
      url: '/v1/me',
      headers: bearer(tokens.accessToken),
      payload: { displayName: 'Nova Strike' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.displayName).toBe('Nova Strike');
  });
});

describe('refresh tokens', () => {
  it('rotates on every refresh', async () => {
    const { tokens } = await guest(app);
    const r1 = await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: tokens.refreshToken } });
    expect(r1.statusCode).toBe(200);
    const next = r1.json().tokens;
    expect(next.refreshToken).not.toBe(tokens.refreshToken);
    const me = await app.inject({ url: '/v1/me', headers: bearer(next.accessToken) });
    expect(me.statusCode).toBe(200);
  });

  it('revokes the whole session when a rotated token is replayed', async () => {
    const { tokens } = await guest(app);
    const r1 = await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: tokens.refreshToken } });
    const stolenReplay = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: tokens.refreshToken },
    });
    expect(stolenReplay.statusCode).toBe(401);
    // The legitimate newer token is now dead too.
    const legit = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      payload: { refreshToken: r1.json().tokens.refreshToken },
    });
    expect(legit.statusCode).toBe(401);
  });

  it('logout revokes the session', async () => {
    const { tokens } = await guest(app);
    const out = await app.inject({ method: 'POST', url: '/v1/auth/logout', payload: { refreshToken: tokens.refreshToken } });
    expect(out.statusCode).toBe(204);
    const r = await app.inject({ method: 'POST', url: '/v1/auth/refresh', payload: { refreshToken: tokens.refreshToken } });
    expect(r.statusCode).toBe(401);
  });
});

describe('google sign-in', () => {
  it('creates an account once and signs into the same one afterwards', async () => {
    const first = await app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: 'google:g-100:Ada Lovelace' } });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toMatchObject({ isNewUser: true, user: { displayName: 'Ada Lovelace', isGuest: false } });

    const again = await app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: 'google:g-100:Ada Lovelace' } });
    expect(again.json()).toMatchObject({ isNewUser: false, user: { id: first.json().user.id } });
  });

  it('rejects invalid Google tokens', async () => {
    const res = await app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: 'garbage' } });
    expect(res.statusCode).toBe(401);
  });

  it('upgrades a guest to Google while keeping the same player', async () => {
    const { user, tokens } = await guest(app);
    const link = await app.inject({
      method: 'POST',
      url: '/v1/auth/link/google',
      headers: bearer(tokens.accessToken),
      payload: { idToken: 'google:g-200:Grace' },
    });
    expect(link.statusCode).toBe(200);
    expect(link.json().user).toMatchObject({ id: user.id, isGuest: false });

    const signIn = await app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: 'google:g-200:Grace' } });
    expect(signIn.json().user.id).toBe(user.id);
  });

  it('refuses to link a Google account owned by someone else', async () => {
    await app.inject({ method: 'POST', url: '/v1/auth/google', payload: { idToken: 'google:g-300:Owner' } });
    const { tokens } = await guest(app);
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/link/google',
      headers: bearer(tokens.accessToken),
      payload: { idToken: 'google:g-300:Owner' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('identity_in_use');
  });
});
