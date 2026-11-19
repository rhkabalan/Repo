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

const mecca = catalog.chapters[0]!.mission;

describe('ATHAR content catalog', () => {
  it('has the six chapters in order, including the return to Ghifar', () => {
    expect(catalog.chapters.map((c) => [c.order, c.id])).toEqual([
      [1, 'mecca'],
      [2, 'ghifar'],
      [3, 'medina'],
      [4, 'tabuk'],
      [5, 'sham'],
      [6, 'rabadhah'],
    ]);
  });

  it('awards 208 XP for a complete Mecca adventure', () => {
    expect(maxMissionXp(mecca)).toBe(208);
  });

  it('provides every string in both Arabic and English', () => {
    const strings: { path: string; ar: string; en: string }[] = [];
    walkLocalized(catalog, 'catalog', strings);
    expect(strings.length).toBeGreaterThan(80);
    for (const s of strings) {
      expect(s.ar.trim(), s.path).not.toBe('');
      expect(s.en.trim(), s.path).not.toBe('');
      expect(s.ar, `${s.path} should contain Arabic script`).toMatch(/[؀-ۿ]/);
    }
  });

  it('keeps every action fictional and every historical account sourced', () => {
    for (const { mission } of catalog.chapters) {
      for (const e of mission.encounters) expect(e.meta.certainty, e.id).toBe('fictional');
      for (const p of mission.puzzles) expect(p.meta.certainty, p.id).toBe('fictional');
      for (const d of mission.discoveries) {
        expect(d.meta.certainty, d.id).not.toBe('fictional');
        if (d.meta.certainty === 'sourced') expect(d.sources.length, `${d.id} needs a source`).toBeGreaterThan(0);
      }
    }
  });

  it('has consistent internal references', () => {
    const skillIds = new Set(catalog.skills.map((s) => s.id));
    const badgeIds = new Set(catalog.badges.map((b) => b.id));
    const itemIds = new Set(catalog.items.map((i) => i.id));
    const itemsOk = (items?: Record<string, number>) => Object.keys(items ?? {}).forEach((id) => expect(itemIds.has(id), id).toBe(true));
    for (const u of catalog.upgrades) u.costs.forEach(itemsOk);
    for (const { mission: m } of catalog.chapters) {
      const areas = new Set(m.areas.map((a) => a.id));
      const puzzles = new Set(m.puzzles.map((p) => p.id));
      const discoveries = new Set(m.discoveries.map((d) => d.id));
      const encounters = new Set(m.encounters.map((e) => e.id));
      expect(badgeIds.has(m.completionBadge), m.completionBadge).toBe(true);
      for (const a of m.areas) {
        if (a.unlockedBy) expect(puzzles.has(a.unlockedBy)).toBe(true);
        if (a.unlockedByEncounter) expect(encounters.has(a.unlockedByEncounter)).toBe(true);
      }
      for (const d of m.discoveries) {
        expect(areas.has(d.areaId)).toBe(true);
        if (d.badge) expect(catalog.badges.find((b) => b.id === d.badge)?.category).toBe('history');
      }
      for (const p of m.puzzles) {
        expect(areas.has(p.areaId)).toBe(true);
        if (p.kind === 'sequence') {
          const optionIds = new Set(p.options.map((o) => o.id));
          for (const s of p.solution) expect(optionIds.has(s)).toBe(true);
        }
      }
      for (const c of m.collectibles) {
        expect(areas.has(c.areaId), c.id).toBe(true);
        if (c.item === 'fragment') expect(c.title && c.text, c.id).toBeTruthy();
        else expect(itemIds.has(c.item), c.item).toBe(true);
      }
      for (const e of m.encounters) {
        expect(areas.has(e.areaId)).toBe(true);
        Object.values(e.rewards).forEach((r) => itemsOk(r?.items));
        Object.values(e.requires ?? {}).forEach(itemsOk);
      }
      for (const t of m.tasks) {
        itemsOk(t.consumes);
        itemsOk(t.rewards);
        if (t.badge) expect(badgeIds.has(t.badge)).toBe(true);
      }
      for (const id of m.completionRequiresDiscoveries) expect(discoveries.has(id)).toBe(true);
      for (const c of m.choices) for (const o of c.options) for (const s of Object.keys(o.skills ?? {})) expect(skillIds.has(s)).toBe(true);
    }
  });

  it('strips editor notes when localizing', () => {
    const json = JSON.stringify(localize(catalog, 'ar'));
    expect(json).not.toContain('editorNote');
    expect(json).toContain('ساحة التدريب');
    expect(json).not.toContain('Training Yard');
  });
});
