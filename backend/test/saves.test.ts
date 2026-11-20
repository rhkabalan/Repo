import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, guest, makeApp } from './helpers.js';

let app: FastifyInstance;
let auth: Record<string, string>;
beforeAll(async () => {
  app = await makeApp();
  auth = bearer((await guest(app)).tokens.accessToken);
});
afterAll(async () => app.close());

const put = (slot: string, payload: object) => app.inject({ method: 'PUT', url: `/v1/saves/${slot}`, headers: auth, payload });

describe('cloud saves', () => {
  it('writes, reads and lists slots', async () => {
    const w = await put('main', { data: { level: 3, coins: 120 } });
    expect(w.statusCode).toBe(200);
    expect(w.json()).toMatchObject({ slot: 'main', version: 1 });

    const r = await app.inject({ url: '/v1/saves/main', headers: auth });
    expect(r.json()).toMatchObject({ version: 1, data: { level: 3, coins: 120 } });

    const list = await app.inject({ url: '/v1/saves', headers: auth });
    expect(list.json().slots).toEqual([expect.objectContaining({ slot: 'main', version: 1 })]);
  });

  it('detects conflicting writes from two devices', async () => {
    await put('conflict', { data: { a: 1 } });
    const deviceA = await put('conflict', { data: { a: 2 }, expectedVersion: 1 });
    expect(deviceA.json().version).toBe(2);
    const deviceB = await put('conflict', { data: { a: 3 }, expectedVersion: 1 });
    expect(deviceB.statusCode).toBe(409);
    expect(deviceB.json().error).toMatchObject({ code: 'version_conflict', details: { currentVersion: 2 } });
  });

  it('supports create-only writes with expectedVersion 0', async () => {
    expect((await put('fresh', { data: 1, expectedVersion: 0 })).statusCode).toBe(200);
    expect((await put('fresh', { data: 2, expectedVersion: 0 })).statusCode).toBe(409);
  });

  it('rejects bad slot names and deletes slots', async () => {
    expect((await put('bad slot!', { data: 1 })).statusCode).toBe(400);
    const del = await app.inject({ method: 'DELETE', url: '/v1/saves/fresh', headers: auth });
    expect(del.statusCode).toBe(204);
    expect((await app.inject({ url: '/v1/saves/fresh', headers: auth })).statusCode).toBe(404);
  });

  it('keeps saves private to their owner', async () => {
    const other = bearer((await guest(app)).tokens.accessToken);
    expect((await app.inject({ url: '/v1/saves/main', headers: other })).statusCode).toBe(404);
  });
});
