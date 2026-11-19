import { describe, expect, it } from 'vitest';
import { catalog } from '../src/journey/content/catalog.js';
import { maxMissionXp } from '../src/journey/engine.js';
import { localize } from '../src/journey/localize.js';

function walkLocalized(value: unknown, path: string, out: { path: string; ar: string; en: string }[]) {
  if (typeof value !== 'object' || value === null) return;
  const v = value as Record<string, unknown>;
  if (typeof v.ar === 'string' && typeof v.en === 'string') {
    out.push({ path, ar: v.ar, en: v.en });
    return;
  }
  for (const [k, child] of Object.entries(v)) walkLocalized(child, `${path}.${k}`, out);
}

describe('ATHAR content catalog', () => {
  it('has the five chapters in chronological order', () => {
    expect(catalog.chapters.map((c) => [c.order, c.id])).toEqual([
      [1, 'mecca'],
      [2, 'medina'],
      [3, 'tabuk'],
      [4, 'sham'],
      [5, 'rabadhah'],
    ]);
  });

  it('awards exactly 120 XP for a perfect Mecca mission', () => {
    expect(maxMissionXp(catalog.chapters[0]!.mission)).toBe(120);
  });

  it('provides every string in both Arabic and English', () => {
    const strings: { path: string; ar: string; en: string }[] = [];
    walkLocalized(catalog, 'catalog', strings);
    expect(strings.length).toBeGreaterThan(50);
    for (const s of strings) {
      expect(s.ar.trim(), s.path).not.toBe('');
      expect(s.en.trim(), s.path).not.toBe('');
      expect(s.ar, `${s.path} should contain Arabic script`).toMatch(/[؀-ۿ]/);
    }
  });

  it('has consistent internal references', () => {
    const skillIds = new Set(catalog.skills.map((s) => s.id));
    const badgeIds = new Set(catalog.badges.map((b) => b.id));
    for (const { mission: m } of catalog.chapters) {
      const areas = new Set(m.areas.map((a) => a.id));
      const puzzles = new Set(m.puzzles.map((p) => p.id));
      const discoveries = new Set(m.discoveries.map((d) => d.id));
      expect(badgeIds.has(m.completionBadge), m.completionBadge).toBe(true);
      for (const a of m.areas) if (a.unlockedBy) expect(puzzles.has(a.unlockedBy)).toBe(true);
      for (const d of m.discoveries) expect(areas.has(d.areaId)).toBe(true);
      for (const p of m.puzzles) {
        expect(areas.has(p.areaId)).toBe(true);
        const optionIds = new Set(p.options.map((o) => o.id));
        for (const s of p.solution) expect(optionIds.has(s), `${p.id} solution ${s}`).toBe(true);
        for (const d of p.requiresDiscoveries) expect(discoveries.has(d)).toBe(true);
      }
      for (const id of m.completionRequiresPuzzles) expect(puzzles.has(id)).toBe(true);
      for (const c of m.choices) {
        if (c.requiresPuzzle) expect(puzzles.has(c.requiresPuzzle)).toBe(true);
        for (const o of c.options) for (const s of Object.keys(o.skills ?? {})) expect(skillIds.has(s), s).toBe(true);
      }
      for (const t of m.tasks) if (t.badge) expect(badgeIds.has(t.badge)).toBe(true);
    }
  });

  it('never marks a historical account as sourced-and-approved without sources', () => {
    for (const { mission } of catalog.chapters) {
      for (const d of mission.discoveries) {
        if (d.meta.review === 'approved' && d.meta.certainty === 'sourced') {
          expect(d.sources.length, `${d.id} needs sources`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('strips puzzle solutions and editor notes when localizing', () => {
    const json = JSON.stringify(localize(catalog, 'ar'));
    expect(json).not.toContain('"solution"');
    expect(json).not.toContain('editorNote');
    expect(json).toContain('زقاق الضيافة');
    expect(json).not.toContain('Hospitality Lane');
  });
});
