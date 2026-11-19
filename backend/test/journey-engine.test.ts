import { describe, expect, it } from 'vitest';
import { catalog } from '../src/journey/content/catalog.js';
import { applyEvent, deriveSkills, initialState, type JourneyEvent, type JourneyState } from '../src/journey/engine.js';

const M = 'mecca';
const play = (state: JourneyState, ...events: JourneyEvent[]) =>
  events.reduce((s, e) => applyEvent(catalog, s, e).state, state);

const perfectMecca: JourneyEvent[] = [
  { type: 'chapter.start', chapterId: M },
  { type: 'choice.make', chapterId: M, choiceId: 'guide-approach', optionId: 'verbal-clue' },
  { type: 'discovery.find', chapterId: M, discoveryId: 'ali-hospitality' },
  { type: 'puzzle.attempt', chapterId: M, puzzleId: 'passage', answer: ['sun', 'shelter', 'water'] },
  { type: 'discovery.find', chapterId: M, discoveryId: 'public-declaration' },
  { type: 'task.progress', chapterId: M, taskId: 'water-delivery', amount: 3 },
  { type: 'puzzle.attempt', chapterId: M, puzzleId: 'story-order', answer: ['arrival', 'ali-welcome', 'declaration'] },
  { type: 'choice.make', chapterId: M, choiceId: 'journal-emphasis', optionId: 'courage' },
  { type: 'mission.complete', chapterId: M },
];

describe('journey engine', () => {
  it('starts with only Mecca available', () => {
    const s = initialState(catalog);
    expect(Object.entries(s.chapters).map(([id, c]) => [id, c.status])).toEqual([
      ['mecca', 'available'],
      ['medina', 'locked'],
      ['tabuk', 'locked'],
      ['sham', 'locked'],
      ['rabadhah', 'locked'],
    ]);
  });

  it('awards 120 XP, both badges and unlocks Medina for a perfect run', () => {
    const s = play(initialState(catalog), ...perfectMecca);
    expect(s.xp).toBe(120);
    expect(s.badges.sort()).toEqual(['chapter-mecca', 'compassion']);
    expect(s.chapters.mecca!.status).toBe('completed');
    expect(s.chapters.medina!.status).toBe('available');
    expect(deriveSkills(catalog, s)).toMatchObject({ memory: 1, courage: 1 });
  });

  it('keeps the courtyard closed until the passage is solved', () => {
    const s = play(initialState(catalog), perfectMecca[2]!);
    expect(() =>
      applyEvent(catalog, s, { type: 'discovery.find', chapterId: M, discoveryId: 'public-declaration' }),
    ).toThrow(/not open/);
  });

  it('gives feedback on wrong answers and allows retries', () => {
    const wrong = applyEvent(catalog, initialState(catalog), {
      type: 'puzzle.attempt',
      chapterId: M,
      puzzleId: 'passage',
      answer: ['sun', 'water', 'shelter'],
    });
    expect(wrong.result).toEqual({ correct: false, attempts: 1, correctPrefix: 1 });
    expect(wrong.state.xp).toBe(0);
    const right = applyEvent(catalog, wrong.state, perfectMecca[3]!);
    expect(right.result).toMatchObject({ correct: true, attempts: 2, openedAreas: ['meeting-courtyard'] });
    expect(right.awards).toEqual([{ type: 'xp', amount: 20, reason: 'puzzle' }]);
  });

  it('requires both accounts before the story-order puzzle', () => {
    const s = play(initialState(catalog), ...perfectMecca.slice(0, 4));
    expect(() => applyEvent(catalog, s, perfectMecca[6]!)).toThrow(/accounts first/);
  });

  it('refuses to complete an unfinished mission and says what is missing', () => {
    const s = play(initialState(catalog), ...perfectMecca.slice(0, 5));
    try {
      applyEvent(catalog, s, { type: 'mission.complete', chapterId: M });
      expect.unreachable();
    } catch (err) {
      expect((err as { details: unknown }).details).toEqual({ puzzles: ['story-order'], choices: ['journal-emphasis'] });
    }
  });

  it('blocks locked chapters', () => {
    expect(() => applyEvent(catalog, initialState(catalog), { type: 'chapter.start', chapterId: 'medina' })).toThrow(
      /previous chapter/,
    );
  });

  it('lets players replay with another choice without farming XP', () => {
    const done = play(initialState(catalog), ...perfectMecca);
    const replayEvents = perfectMecca.map((e) =>
      e.type === 'choice.make' && e.choiceId === 'journal-emphasis' ? { ...e, optionId: 'hospitality' } : e,
    );
    const again = play(done, { type: 'chapter.replay', chapterId: M }, ...replayEvents.slice(1));
    expect(again.xp).toBe(120);
    expect(again.chapters.mecca!.timesCompleted).toBe(2);
    expect(again.chapters.mecca!.committedChoices['journal-emphasis']).toBe('hospitality');
    const skills = deriveSkills(catalog, again);
    expect(skills.courage).toBe(0);
    expect(skills.empathy).toBe(1);
  });

  it('does not mutate the input state', () => {
    const s = initialState(catalog);
    const snapshot = JSON.stringify(s);
    applyEvent(catalog, s, perfectMecca[2]!);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
