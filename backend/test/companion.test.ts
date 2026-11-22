import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { deeds, narration, objectives } from '../src/journey/content/companion.js';

const voiceDir = resolve(__dirname, '../../client/public/companion/voice');

describe('companion chapter content', () => {
  it('has a recording in both languages for every narration line', () => {
    for (const n of narration) {
      for (const lang of ['ar', 'en'] as const) expect(existsSync(resolve(voiceDir, `${n.id}.${lang}.mp3`)), `${n.id}.${lang}`).toBe(true);
    }
  });

  it('cites a source for every historical line, and none for the game’s own framing', () => {
    for (const n of narration) {
      expect(n.text.ar.trim()).not.toBe('');
      expect(n.text.en.trim()).not.toBe('');
      if (n.sourced) expect(n.sources.length, n.id).toBeGreaterThan(0);
      else expect(n.sources.length, n.id).toBe(0);
    }
  });

  it('cites only Shia works', () => {
    const cited = narration.flatMap((n) => n.sources.map((s) => s.en)).join(' | ');
    for (const bad of ['Bukhari', 'Muslim ', 'Tirmidhi', 'Ibn Hisham', 'Tabari']) expect(cited).not.toContain(bad);
  });

  it('pairs every good deed with a Qur’an verse and reference', () => {
    const ids = new Set<string>();
    for (const d of deeds) {
      expect(ids.has(d.id)).toBe(false);
      ids.add(d.id);
      expect(d.hasanat).toBeGreaterThan(0);
      expect(d.verse.ar).toMatch(/﴿.+﴾/);
      expect(d.ref.en).toMatch(/^Qur'an \d+:\d+$/);
    }
    for (const o of Object.values(objectives)) expect(o.ar && o.en).toBeTruthy();
  });
});
