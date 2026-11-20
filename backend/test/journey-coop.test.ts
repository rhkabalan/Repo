import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bearer, guest, listen, makeApp, TestClient } from './helpers.js';

let app: FastifyInstance;
let url: string;
beforeAll(async () => {
  app = await makeApp();
  url = await listen(app);
});
afterAll(async () => app.close());

const GAME = 'athar-journey';

interface Player {
  id: string;
  token: string;
  client: TestClient;
  seq: number;
}

async function player(name?: string, characterId?: string): Promise<Player> {
  const g = await guest(app, name);
  if (characterId) {
    await app.inject({ method: 'PATCH', url: '/v1/me', headers: bearer(g.tokens.accessToken), payload: { characterId } });
  }
  const client = await TestClient.connect(url, g.tokens.accessToken);
  await client.waitFor('welcome');
  return { id: g.user.id, token: g.tokens.accessToken, client, seq: 0 };
}

const act = (p: Player, action: object) =>
  p.client.send({ t: 'input', seq: ++p.seq, data: { kind: 'action', action } });

/** Host creates a party room; everyone else joins and readies up. */
async function party(size: number, chapterId = 'mecca') {
  const members = await Promise.all(Array.from({ length: size }, (_, i) => player(`Traveler ${i + 1}`)));
  const [host, ...rest] = members;
  host!.client.send({ t: 'room.create', gameId: GAME, partySize: size, options: { chapterId } });
  const code = (await host!.client.waitFor('room.state')).room.code as string;
  for (const m of rest) {
    m.client.send({ t: 'room.join', code });
    await m.client.waitFor('room.state');
    m.client.send({ t: 'room.ready', ready: true });
  }
  return { host: host!, members, code };
}

const journeyOf = async (p: Player) => (await app.inject({ url: '/v1/journey', headers: bearer(p.token) })).json();

async function playMecca(members: Player[]) {
  const [a, b = a, c = b] = members;
  act(a!, { type: 'encounter.resolve', encounterId: 'staff-training', method: 'fight' });
  act(b!, { type: 'item.collect', collectibleId: 'water-1' });
  await a!.client.waitFor('game.state', (m) => m.state.encounters?.['staff-training'] === 'fight');
  act(c!, { type: 'encounter.resolve', encounterId: 'extortioners', method: 'fight' });
  await a!.client.waitFor('game.state', (m) => m.state.openAreas.includes('meeting-courtyard'));
  act(a!, { type: 'discovery.find', discoveryId: 'arrival-hospitality' });
  await a!.client.waitFor('game.state', (m) => m.state.discoveries.includes('arrival-hospitality'));
}

/** XP each member earns from playMecca + completion: 20 + 2 + 30 + 30 + 40. */
const PARTY_XP = 122;

describe('ATHAR co-op journey (1–3 players)', () => {
  it('plays Mecca as a party of three and credits every member', async () => {
    const { host, members } = await party(3);
    host.client.send({ t: 'room.start' });
    await Promise.all(members.map((m) => m.client.waitFor('game.start')));

    // Positions are shared so everyone sees each other walking.
    host.client.send({ t: 'input', seq: ++host.seq, data: { kind: 'move', areaId: 'training-yard', x: 320, y: 180, anim: 'walk' } });
    const seen = await members[1]!.client.waitFor('game.state', (m) =>
      m.state.players.some((p: { id: string; x: number }) => p.id === host.id && p.x === 320),
    );
    expect(seen.state.players).toHaveLength(3);

    // The party can't finish before the obstacle is passed and the account discovered.
    act(host, { type: 'mission.complete' });
    const rejected = await host.client.waitFor('game.event', (m) => m.event.type === 'action.rejected');
    expect(rejected.event.details.puzzles).toEqual(['staff-training', 'extortioners', 'arrival-hospitality']);

    await playMecca(members);

    // Each member writes their own journal reflection.
    const picks = ['hospitality', 'seeking', 'seeking'];
    members.forEach((m, i) => act(m, { type: 'choice.make', choiceId: 'journal-emphasis', optionId: picks[i] }));
    for (const m of members) {
      await host.client.waitFor('game.event', (e) => e.event.type === 'choice.made' && e.event.playerId === m.id);
    }
    act(host, { type: 'mission.complete' });
    const end = await host.client.waitFor('game.end');
    expect(end.results).toHaveLength(3);
    for (const r of end.results) expect(r).toMatchObject({ placement: 1, score: PARTY_XP });

    for (const [i, m] of members.entries()) {
      const j = await journeyOf(m);
      expect(j.xp).toBe(PARTY_XP);
      expect(j.chapters[0].status).toBe('completed');
      expect(j.chapters[1].status).toBe('available');
      expect(j.achievements.badges.map((x: { badgeId: string }) => x.badgeId).sort()).toEqual(['chapter-mecca', 'history-arrival']);
      expect(j.journal.reflections[0].optionId).toBe(['hospitality', 'seeking', 'seeking'][i]);
    }
    // Co-op: nobody "lost".
    const stats = (await app.inject({ url: '/v1/me', headers: bearer(members[1]!.token) })).json().stats;
    expect(stats).toMatchObject({ gamesPlayed: 1, wins: 0, losses: 0, xp: PARTY_XP });
    members.forEach((m) => m.client.close());
  });

  it('plays as a party of two', async () => {
    const { host, members } = await party(2);
    host.client.send({ t: 'room.start' });
    await host.client.waitFor('game.start');
    await playMecca(members);
    for (const m of members) act(m, { type: 'choice.make', choiceId: 'journal-emphasis', optionId: 'seeking' });
    for (const m of members) {
      await host.client.waitFor('game.event', (e) => e.event.type === 'choice.made' && e.event.playerId === m.id);
    }
    act(members[1]!, { type: 'mission.complete' });
    await host.client.waitFor('game.end');
    for (const m of members) expect((await journeyOf(m)).xp).toBe(PARTY_XP);
    members.forEach((m) => m.client.close());
  });

  it('plays single-player through the same room system', async () => {
    const solo = await player();
    solo.client.send({ t: 'room.create', gameId: GAME, partySize: 1, options: { chapterId: 'mecca' } });
    await solo.client.waitFor('game.start'); // starts immediately, no lobby
    await playMecca([solo]);
    act(solo, { type: 'choice.make', choiceId: 'journal-emphasis', optionId: 'hospitality' });
    act(solo, { type: 'mission.complete' });
    await solo.client.waitFor('game.end');
    expect((await journeyOf(solo)).xp).toBe(PARTY_XP);
    solo.client.close();
  });

  it("shows each member's chosen character in the room", async () => {
    const host = await player('Hamza', 'steadfast');
    const friend = await player('Layla', 'elder');
    host.client.send({ t: 'room.create', gameId: GAME, partySize: 2, options: { chapterId: 'mecca' } });
    const code = (await host.client.waitFor('room.state')).room.code;
    friend.client.send({ t: 'room.join', code });
    const state = await host.client.waitFor('room.state', (m) => m.room.players.length === 2);
    expect(state.room.players.map((p: { displayName: string; characterId: string }) => [p.displayName, p.characterId])).toEqual([
      ['Hamza', 'steadfast'],
      ['Layla', 'elder'],
    ]);
    [host, friend].forEach((p) => p.client.close());
  });

  it('waits for every seat to be filled and rejects extra players', async () => {
    const host = await player();
    host.client.send({ t: 'room.create', gameId: GAME, partySize: 2, options: { chapterId: 'mecca' } });
    const room = (await host.client.waitFor('room.state')).room;
    expect(room).toMatchObject({ partySize: 2, maxPlayers: 2, options: { chapterId: 'mecca' } });

    host.client.send({ t: 'room.start' });
    expect((await host.client.waitFor('error')).message).toMatch(/all 2 players/);

    const friend = await player();
    friend.client.send({ t: 'room.join', code: room.code });
    await friend.client.waitFor('room.state');
    const extra = await player();
    extra.client.send({ t: 'room.join', code: room.code });
    expect((await extra.client.waitFor('error')).code).toBe('room_full');
    [host, friend, extra].forEach((p) => p.client.close());
  });

  it("refuses to start a chapter that a member hasn't unlocked", async () => {
    const { host, members } = await party(2, 'medina');
    host.client.send({ t: 'room.start' });
    const err = await host.client.waitFor('error', (m) => m.code === 'chapter_locked');
    expect(err.message).toMatch(/Traveler 1, Traveler 2/);
    expect((await host.client.waitFor('room.state')).room.phase).toBe('lobby');
    members.forEach((m) => m.client.close());
  });

  it('validates party size, options and quick-match', async () => {
    const p = await player();
    p.client.send({ t: 'room.create', gameId: GAME, partySize: 4, options: { chapterId: 'mecca' } });
    expect((await p.client.waitFor('error')).code).toBe('bad_party_size');
    p.client.send({ t: 'room.create', gameId: GAME, partySize: 2, options: {} });
    expect((await p.client.waitFor('error', (m) => m.code === 'bad_options')).code).toBe('bad_options');
    p.client.send({ t: 'queue.join', gameId: GAME });
    expect((await p.client.waitFor('error', (m) => m.code === 'no_matchmaking')).code).toBe('no_matchmaking');
    p.client.close();
  });
});
