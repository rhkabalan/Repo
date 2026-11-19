import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, guest, makeApp } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => (app = await makeApp()));
afterAll(async () => app.close());

describe('journey API', () => {
  it('serves the catalog in Arabic or English without solutions', async () => {
    const ar = await app.inject({ url: '/v1/journey/content', headers: { 'accept-language': 'ar-SA,ar;q=0.9' } });
    expect(ar.json().lang).toBe('ar');
    expect(ar.json().chapters[0].setting).toBe('مكة');
    const en = await app.inject({ url: '/v1/journey/content?lang=en' });
    expect(en.json().chapters[0].mission.areas[0].name).toBe('Hospitality Lane');
    expect(en.body).not.toContain('"solution"');
  });

  it('plays the Mecca mission end to end and syncs progress to the account', async () => {
    const { tokens } = await guest(app);
    const auth = bearer(tokens.accessToken);
    const send = (event: object) =>
      app.inject({ method: 'POST', url: '/v1/journey/events?lang=en', headers: auth, payload: event });

    const start = await app.inject({ url: '/v1/journey', headers: auth });
    expect(start.json().chapters.map((c: { status: string }) => c.status)).toEqual([
      'available', 'locked', 'locked', 'locked', 'locked',
    ]);

    expect((await send({ type: 'choice.make', chapterId: 'mecca', choiceId: 'guide-approach', optionId: 'route-board' })).statusCode).toBe(200);
    const found = await send({ type: 'discovery.find', chapterId: 'mecca', discoveryId: 'ali-hospitality' });
    expect(found.json().awards).toEqual([{ type: 'xp', amount: 20, reason: 'discovery' }]);

    const blocked = await send({ type: 'discovery.find', chapterId: 'mecca', discoveryId: 'public-declaration' });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe('area_locked');

    const wrong = await send({ type: 'puzzle.attempt', chapterId: 'mecca', puzzleId: 'passage', answer: ['water', 'sun', 'shelter'] });
    expect(wrong.json().result).toMatchObject({ correct: false, attempts: 1 });
    const right = await send({ type: 'puzzle.attempt', chapterId: 'mecca', puzzleId: 'passage', answer: ['sun', 'shelter', 'water'] });
    expect(right.json().result).toMatchObject({ correct: true, openedAreas: ['meeting-courtyard'] });

    await send({ type: 'discovery.find', chapterId: 'mecca', discoveryId: 'public-declaration' });
    for (let i = 0; i < 3; i++) await send({ type: 'task.progress', chapterId: 'mecca', taskId: 'water-delivery', amount: 1 });
    await send({ type: 'puzzle.attempt', chapterId: 'mecca', puzzleId: 'story-order', answer: ['arrival', 'ali-welcome', 'declaration'] });
    await send({ type: 'choice.make', chapterId: 'mecca', choiceId: 'journal-emphasis', optionId: 'steadfastness' });
    const done = await send({ type: 'mission.complete', chapterId: 'mecca' });
    expect(done.statusCode).toBe(200);
    expect(done.json().awards).toEqual([
      { type: 'xp', amount: 40, reason: 'mission_complete' },
      { type: 'badge', badgeId: 'chapter-mecca', name: 'Mecca' },
      { type: 'chapter_unlocked', chapterId: 'medina' },
    ]);

    // A different device signing into the same account sees the same journey.
    const view = (await app.inject({ url: '/v1/journey?lang=ar', headers: auth })).json();
    expect(view.xp).toBe(120);
    expect(view.chapters[0]).toMatchObject({ status: 'completed', earnedXp: 120, maxXp: 120 });
    expect(view.chapters[1].status).toBe('available');
    expect(view.achievements).toMatchObject({ completedChapters: 1, discoveredClues: 2 });
    expect(view.achievements.badges.map((b: { name: string }) => b.name).sort()).toEqual(['وسام الرحمة', 'وسام مكة']);
    expect(view.journal.accounts).toHaveLength(2);
    expect(view.journal.reflections[0].text).toContain('أبو ذرٍّ');

    // Journey XP counts toward the account level.
    const me = (await app.inject({ url: '/v1/me', headers: auth })).json();
    expect(me.stats.xp).toBe(120);
    expect(me.stats.level).toBe(2);
  });

  it('handles simultaneous events from two devices without double-awarding', async () => {
    const auth = bearer((await guest(app)).tokens.accessToken);
    const event = { type: 'discovery.find', chapterId: 'mecca', discoveryId: 'ali-hospitality' };
    await Promise.all(
      Array.from({ length: 5 }, () => app.inject({ method: 'POST', url: '/v1/journey/events', headers: auth, payload: event })),
    );
    expect((await app.inject({ url: '/v1/journey', headers: auth })).json().xp).toBe(20);
  });

  it('validates events', async () => {
    const auth = bearer((await guest(app)).tokens.accessToken);
    const res = await app.inject({ method: 'POST', url: '/v1/journey/events', headers: auth, payload: { type: 'teleport' } });
    expect(res.statusCode).toBe(400);
    const locked = await app.inject({ method: 'POST', url: '/v1/journey/events', headers: auth, payload: { type: 'chapter.start', chapterId: 'medina' } });
    expect(locked.json().error.code).toBe('chapter_locked');
  });
});
