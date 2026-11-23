import { describe, expect, it } from 'vitest';
import { cardsForTier, isPlacementCorrect, timelineAnchorId, timelineEvents, type TimelineEvent } from '../src/journey/content/timeline.js';

const byId = (id: string) => timelineEvents.find((e) => e.id === id) as TimelineEvent;

describe('timeline cards', () => {
  it('are well formed and sourced', () => {
    const ids = new Set<string>();
    for (const e of timelineEvents) {
      expect(ids.has(e.id), e.id).toBe(false);
      ids.add(e.id);
      expect(e.start, e.id).toBeLessThanOrEqual(e.end);
      expect(e.sources.length, e.id).toBeGreaterThan(0);
      for (const t of [e.title, e.clue, e.takeaway, e.displayDate]) {
        expect(t.en.trim(), e.id).not.toBe('');
        expect(t.ar.trim(), e.id).not.toBe('');
      }
      if (e.question) {
        expect(e.question.answer).toBeGreaterThanOrEqual(0);
        expect(e.question.answer).toBeLessThan(e.question.options.length);
      }
      // Undated or disputed events must show their uncertainty.
      if (e.category === 'journey' && e.end - e.start >= 3) expect(e.certainty, e.id).not.toBe('sourced');
    }
    expect(ids.has(timelineAnchorId)).toBe(true);
  });

  it('never places Abu Dharr at Badr or in a battle at Tabuk', () => {
    expect(byId('badr').takeaway.en).toMatch(/not at Badr/);
    expect(byId('tabuk').takeaway.en).toMatch(/No battle/);
  });

  it('gives every tier enough cards for a game', () => {
    for (const tier of ['explorer', 'scholar', 'historian'] as const) {
      const pool = cardsForTier(tier);
      expect(pool.length, tier).toBeGreaterThanOrEqual(12);
      expect(pool.some((e) => e.id === timelineAnchorId)).toBe(false);
    }
  });

  it('scores placements with ranges, same-year ties and margins', () => {
    const hijra = byId('hijra'), tabuk = byId('tabuk'), mecca = byId('mecca-opened'), badr = byId('badr');
    // Same year: either order is fine.
    expect(isPlacementCorrect(tabuk, undefined, mecca, 'scholar')).toBe(true);
    expect(isPlacementCorrect(tabuk, mecca, undefined, 'scholar')).toBe(true);
    // Clearly wrong.
    expect(isPlacementCorrect(badr, tabuk, undefined, 'historian')).toBe(false);
    // A disputed range (622–628) fits before or after Badr (624).
    const toMedina = byId('to-medina');
    expect(isPlacementCorrect(toMedina, undefined, badr, 'historian')).toBe(true);
    expect(isPlacementCorrect(toMedina, badr, undefined, 'historian')).toBe(true);
    // Explorer margin: Hijra (622) just before the Trench (627) is accepted either way.
    const trench = byId('trench');
    expect(isPlacementCorrect(hijra, trench, undefined, 'explorer')).toBe(true);
    expect(isPlacementCorrect(hijra, trench, undefined, 'scholar')).toBe(false);
  });
});
