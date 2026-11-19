import { describe, expect, it } from 'vitest';
import { catalog } from '../src/journey/content/catalog.js';
import { applyEvent, initialState, upgradeState, type JourneyEvent, type JourneyState } from '../src/journey/engine.js';

const M = 'mecca';
const play = (state: JourneyState, ...events: JourneyEvent[]) => events.reduce((s, e) => applyEvent(catalog, s, e).state, state);
const collect = (id: string): JourneyEvent => ({ type: 'item.collect', chapterId: M, collectibleId: id });
const resolve = (id: string, method: 'fight' | 'sneak' | 'route'): JourneyEvent => ({ type: 'encounter.resolve', chapterId: M, encounterId: id, method });

/** Everything in the Mecca adventure, solving the obstacle with `method`. */
const fullRun = (method: 'fight' | 'sneak' | 'route'): JourneyEvent[] => [
  resolve('staff-training', 'fight'),
  ...['water-1', 'water-2', 'water-3', 'provisions-1', 'wood-1', 'wood-2', 'rope-1', 'merchant-bundle', 'fragment-1', 'fragment-2'].map(collect),
  { type: 'task.progress', chapterId: M, taskId: 'merchant-goods', amount: 1 },
  { type: 'task.progress', chapterId: M, taskId: 'water-delivery', amount: 2 },
  { type: 'puzzle.attempt', chapterId: M, puzzleId: 'collapsed-passage', answer: ['solved'] },
  ...['provisions-2', 'rope-2', 'fragment-3'].map(collect),
  resolve('extortioners', method),
  { type: 'discovery.find', chapterId: M, discoveryId: 'arrival-hospitality' },
  { type: 'choice.make', chapterId: M, choiceId: 'journal-emphasis', optionId: 'seeking' },
  { type: 'mission.complete', chapterId: M },
];

describe('adventure engine', () => {
  it('awards the full 208 XP, both badge types, and unlocks Ghifar', () => {
    const s = play(initialState(catalog), ...fullRun('fight'));
    expect(s.xp).toBe(208);
    expect(s.badges.sort()).toEqual(['chapter-mecca', 'compassion', 'history-arrival']);
    expect(s.chapters.mecca!.status).toBe('completed');
    expect(s.chapters.ghifar!.status).toBe('available');
    expect(s.fragments).toHaveLength(3);
  });

  it('collects items into the inventory up to capacity', () => {
    let s = play(initialState(catalog), collect('water-1'), collect('water-3'));
    expect(s.inventory.water).toBe(2);
    s = { ...s, inventory: { ...s.inventory, water: 3 } };
    const full = applyEvent(catalog, s, collect('water-2'));
    expect(full.result).toMatchObject({ added: 0, full: true, capacity: 3 });
    expect(full.state.chapters.mecca!.collectibles).not.toContain('water-2'); // stays in the world
  });

  it('never collects the same pickup twice in a run', () => {
    const s = play(initialState(catalog), collect('wood-1'), collect('wood-1'));
    expect(s.inventory.wood).toBe(2);
  });

  it('consumes items for tasks and hands out rewards', () => {
    const s0 = initialState(catalog);
    expect(() => applyEvent(catalog, s0, { type: 'task.progress', chapterId: M, taskId: 'merchant-goods', amount: 1 })).toThrow(/what is needed/);
    const s = play(s0, collect('merchant-bundle'), { type: 'task.progress', chapterId: M, taskId: 'merchant-goods', amount: 1 });
    expect(s.inventory).toMatchObject({ 'merchant-bundle': 0, 'side-gate-key': 1 });
  });

  it('keeps the courtyard closed until the obstacle is resolved', () => {
    const s = play(initialState(catalog), resolve('staff-training', 'fight'));
    expect(() => applyEvent(catalog, s, { type: 'discovery.find', chapterId: M, discoveryId: 'arrival-hospitality' })).toThrow(/not open/);
  });

  it('opens the collapsed passage only after the mechanism is solved', () => {
    expect(() => applyEvent(catalog, initialState(catalog), collect('rope-2'))).toThrow(/not open/);
    const s = play(initialState(catalog), { type: 'puzzle.attempt', chapterId: M, puzzleId: 'collapsed-passage', answer: ['solved'] }, collect('rope-2'));
    expect(s.inventory.rope).toBe(1);
  });

  it('requires the side-gate key for the other route', () => {
    expect(() => applyEvent(catalog, initialState(catalog), resolve('extortioners', 'route'))).toThrow(/need something/);
    const s = play(initialState(catalog), collect('merchant-bundle'), { type: 'task.progress', chapterId: M, taskId: 'merchant-goods', amount: 1 }, resolve('extortioners', 'route'));
    expect(s.chapters.mecca!.encounters.extortioners).toBe('route');
  });

  it('accepts all three ways past the obstacle, each rewarded differently', () => {
    for (const method of ['fight', 'sneak', 'route'] as const) {
      const s = play(initialState(catalog), ...fullRun(method));
      expect(s.chapters.mecca!.status, method).toBe('completed');
    }
    expect(() => applyEvent(catalog, initialState(catalog), resolve('staff-training', 'sneak'))).toThrow(/not a way/);
  });

  it('says what is missing before completion', () => {
    try {
      applyEvent(catalog, initialState(catalog), { type: 'mission.complete', chapterId: M });
      expect.unreachable();
    } catch (err) {
      expect((err as { details: unknown }).details).toMatchObject({
        encounters: ['staff-training', 'extortioners'],
        discoveries: ['arrival-hospitality'],
      });
    }
  });

  it('buys upgrades with materials and raises capacity', () => {
    const s = play(initialState(catalog), collect('rope-1'), { type: 'puzzle.attempt', chapterId: M, puzzleId: 'collapsed-passage', answer: ['solved'] }, collect('rope-2'));
    const up = applyEvent(catalog, s, { type: 'upgrade.buy', upgradeId: 'capacity', chapterId: 'global' });
    expect(up.state.upgrades.capacity).toBe(1);
    expect(up.state.inventory.rope).toBe(0);
    expect(() => applyEvent(catalog, up.state, { type: 'upgrade.buy', upgradeId: 'capacity', chapterId: 'global' })).toThrow(/Not enough/);
  });

  it('replays without farming XP, but rewards a new approach', () => {
    const done = play(initialState(catalog), ...fullRun('fight'));
    const again = play(done, { type: 'chapter.replay', chapterId: M }, ...fullRun('sneak').slice(0, -1).filter((e) => e.type !== 'task.progress'), { type: 'mission.complete', chapterId: M });
    expect(again.chapters.mecca!.timesCompleted).toBe(2);
    expect(again.xp).toBe(208 + 30); // only the new sneak approach pays
  });

  it('upgrades old saves: opens Ghifar for players who already finished Mecca', () => {
    const old = initialState(catalog) as JourneyState & Record<string, unknown>;
    old.chapters.mecca!.timesCompleted = 1;
    old.chapters.mecca!.status = 'completed';
    delete (old as Partial<JourneyState>).inventory;
    const up = upgradeState(catalog, { ...old, catalogVersion: 1 });
    expect(up.chapters.ghifar!.status).toBe('available');
    expect(up.inventory).toEqual({});
  });

  it('does not mutate the input state', () => {
    const s = initialState(catalog);
    const snapshot = JSON.stringify(s);
    applyEvent(catalog, s, collect('water-1'));
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
