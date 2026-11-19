import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, guest, makeApp } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => (app = await makeApp()));
afterAll(async () => app.close());

describe('journey API', () => {
  it('serves the catalog in Arabic or English', async () => {
    const ar = await app.inject({ url: '/v1/journey/content', headers: { 'accept-language': 'ar-SA,ar;q=0.9' } });
    expect(ar.json().lang).toBe('ar');
    expect(ar.json().chapters[0].setting).toBe('مكة');
    const en = await app.inject({ url: '/v1/journey/content?lang=en' });
    expect(en.json().chapters[0].mission.areas[0].name).toBe('Training Yard');
    expect(en.json().items.map((i: { id: string }) => i.id)).toContain('water');
  });

  it('plays the Mecca adventure end to end and syncs progress to the account', async () => {
    const auth = bearer((await guest(app)).tokens.accessToken);
    const send = (event: object) => app.inject({ method: 'POST', url: '/v1/journey/events?lang=en', headers: auth, payload: { chapterId: 'mecca', ...event } });

    expect((await send({ type: 'encounter.resolve', encounterId: 'staff-training', method: 'fight' })).json().awards).toEqual([
      { type: 'xp', amount: 20, reason: 'encounter_fight' },
    ]);
    const picked = await send({ type: 'item.collect', collectibleId: 'water-1' });
    expect(picked.json().result).toMatchObject({ added: 1, itemId: 'water', total: 1 });

    const blocked = await send({ type: 'discovery.find', discoveryId: 'arrival-hospitality' });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe('area_locked');

    expect((await send({ type: 'encounter.resolve', encounterId: 'extortioners', method: 'sneak' })).json().result).toMatchObject({
      method: 'sneak',
      openedAreas: ['meeting-courtyard'],
    });
    const found = await send({ type: 'discovery.find', discoveryId: 'arrival-hospitality' });
    expect(found.json().awards).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'badge', badgeId: 'history-arrival', category: 'history' })]),
    );
    const done = await send({ type: 'mission.complete' });
    expect(done.statusCode).toBe(200);
    expect(done.json().awards).toEqual(expect.arrayContaining([{ type: 'chapter_unlocked', chapterId: 'ghifar' }]));

    const view = (await app.inject({ url: '/v1/journey?lang=ar', headers: auth })).json();
    expect(view.chapters[0]).toMatchObject({ status: 'completed', encounters: { 'staff-training': 'fight', extortioners: 'sneak' } });
    expect(view.chapters[1]).toMatchObject({ chapterId: 'ghifar', status: 'available' });
    expect(view.inventory.find((i: { itemId: string }) => i.itemId === 'water')).toMatchObject({ count: 1, capacity: 3, name: 'قربة ماء' });
    expect(view.achievements.historyBadges.map((b: { badgeId: string }) => b.badgeId)).toEqual(['history-arrival']);
    expect(view.upgrades.find((u: { upgradeId: string }) => u.upgradeId === 'stamina')).toMatchObject({ level: 0, nextCost: { provisions: 2 } });
  });

  it('buys upgrades through the API', async () => {
    const auth = bearer((await guest(app)).tokens.accessToken);
    const send = (event: object) => app.inject({ method: 'POST', url: '/v1/journey/events', headers: auth, payload: event });
    await send({ type: 'item.collect', chapterId: 'mecca', collectibleId: 'provisions-1' });
    const poor = await send({ type: 'upgrade.buy', upgradeId: 'stamina' });
    expect(poor.statusCode).toBe(409);
    expect(poor.json().error).toMatchObject({ code: 'missing_items', details: { needs: { provisions: 2 } } });
  });

  it('handles simultaneous events from two devices without double-awarding', async () => {
    const auth = bearer((await guest(app)).tokens.accessToken);
    const event = { type: 'item.collect', chapterId: 'mecca', collectibleId: 'fragment-1' };
    await Promise.all(Array.from({ length: 5 }, () => app.inject({ method: 'POST', url: '/v1/journey/events', headers: auth, payload: event })));
    expect((await app.inject({ url: '/v1/journey', headers: auth })).json().xp).toBe(5);
  });

  it('validates events', async () => {
    const auth = bearer((await guest(app)).tokens.accessToken);
    expect((await app.inject({ method: 'POST', url: '/v1/journey/events', headers: auth, payload: { type: 'teleport' } })).statusCode).toBe(400);
    const locked = await app.inject({ method: 'POST', url: '/v1/journey/events', headers: auth, payload: { type: 'chapter.start', chapterId: 'medina' } });
    expect(locked.json().error.code).toBe('chapter_locked');
  });
});
