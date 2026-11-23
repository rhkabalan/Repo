import { levelForXp } from '../lib/levels.js';
import type { Catalog, Lang } from './content/types.js';
import { capacityFor, deriveSkills, isAreaOpen, maxMissionXp, type Award, type JourneyState } from './engine.js';
import { localize } from './localize.js';

/**
 * Pure presentation of a journey: no database or Node APIs, so the browser's offline
 * single-player build can reuse it exactly.
 */
export class JourneyView {
  constructor(private readonly catalog: Catalog) {}

  localizeAwards(awards: Award[], lang: Lang) {
    return awards.map((a) => {
      if (a.type === 'badge') {
        const badge = this.catalog.badges.find((b) => b.id === a.badgeId);
        return { ...a, name: badge ? badge.name[lang] : a.badgeId, category: badge?.category ?? 'adventure' };
      }
      if (a.type === 'item') {
        const item = this.catalog.items.find((i) => i.id === a.itemId);
        return { ...a, name: item ? item.name[lang] : a.itemId };
      }
      return a;
    });
  }

  /** The player-facing picture of their journey: progress, achievements and journal. */
  view(state: JourneyState, version: number, lang: Lang) {
    const chapters = [...this.catalog.chapters].sort((a, b) => a.order - b.order);
    const skills = deriveSkills(this.catalog, state);

    const journalAccounts = state.collected.flatMap((key) => {
      const [chapterId, discoveryId] = key.split(':');
      const chapter = chapters.find((c) => c.id === chapterId);
      const d = chapter?.mission.discoveries.find((x) => x.id === discoveryId);
      if (!chapter || !d) return [];
      return [localize({ chapterId, discoveryId, title: d.title, body: d.body, sources: d.sources, certainty: d.meta.certainty }, lang)];
    });

    const journalReflections = chapters.flatMap((chapter) => {
      const committed = state.chapters[chapter.id]?.committedChoices ?? {};
      return chapter.mission.choices.flatMap((choice) => {
        const option = choice.options.find((o) => o.id === committed[choice.id]);
        if (!option?.journal) return [];
        return [{ chapterId: chapter.id, choiceId: choice.id, optionId: option.id, text: option.journal[lang] }];
      });
    });

    const fragments = state.fragments.flatMap((key) => {
      const [chapterId, id] = key.split(':');
      const c = chapters.find((x) => x.id === chapterId)?.mission.collectibles.find((x) => x.id === id);
      if (!c?.title || !c.text) return [];
      return [{ chapterId, collectibleId: id, title: c.title[lang], text: c.text[lang], certainty: c.meta.certainty }];
    });

    const badge = (id: string) => {
      const b = this.catalog.badges.find((x) => x.id === id);
      return { badgeId: id, name: b?.name[lang] ?? id, description: b?.description[lang] ?? '', category: b?.category ?? 'adventure' };
    };

    return {
      version,
      catalogVersion: this.catalog.version,
      xp: state.xp,
      level: levelForXp(state.xp),
      chapters: chapters.map((c) => {
        const p = state.chapters[c.id]!;
        return {
          chapterId: c.id,
          order: c.order,
          status: p.status,
          openAreas: c.mission.areas.filter((a) => isAreaOpen(c.mission, p, a.id)).map((a) => a.id),
          discoveries: p.discoveries,
          puzzles: p.puzzles,
          choices: p.choices,
          tasks: p.tasks,
          collectibles: p.collectibles,
          encounters: p.encounters,
          timesCompleted: p.timesCompleted,
          completedAt: p.completedAt,
          earnedXp: this.earnedXp(c.id, state),
          maxXp: maxMissionXp(c.mission),
        };
      }),
      achievements: {
        completedChapters: chapters.filter((c) => state.chapters[c.id]!.timesCompleted > 0).length,
        totalChapters: chapters.length,
        discoveredClues: state.collected.length,
        badges: state.badges.map(badge),
        historyBadges: state.badges.map(badge).filter((b) => b.category === 'history'),
        adventureBadges: state.badges.map(badge).filter((b) => b.category === 'adventure'),
        skills: this.catalog.skills.map((s) => ({ skillId: s.id, name: s.name[lang], level: skills[s.id] ?? 0 })),
      },
      journal: { accounts: journalAccounts, reflections: journalReflections, fragments },
      inventory: this.catalog.items.map((i) => ({
        itemId: i.id,
        name: i.name[lang],
        kind: i.kind,
        count: state.inventory[i.id] ?? 0,
        capacity: capacityFor(this.catalog, state, i.id),
      })),
      upgrades: this.catalog.upgrades.map((u) => {
        const level = state.upgrades[u.id] ?? 0;
        return {
          upgradeId: u.id,
          name: u.name[lang],
          description: u.description[lang],
          level,
          maxLevel: u.costs.length,
          nextCost: u.costs[level] ?? null,
        };
      }),
    };
  }

  private earnedXp(chapterId: string, state: JourneyState): number {
    const chapter = this.catalog.chapters.find((c) => c.id === chapterId)!;
    const m = chapter.mission;
    const has = (k: string) => state.claimed.includes(k);
    return (
      m.discoveries.filter((d) => has(`discovery:${chapterId}:${d.id}`)).reduce((s, d) => s + d.xp, 0) +
      m.puzzles.filter((p) => has(`puzzle:${chapterId}:${p.id}`)).reduce((s, p) => s + p.xp, 0) +
      m.tasks.filter((t) => has(`task:${chapterId}:${t.id}`)).reduce((s, t) => s + t.xp, 0) +
      m.collectibles
        .filter((c) => has(`collect:${chapterId}:${c.id}`) || has(`fragment:${chapterId}:${c.id}`))
        .reduce((s, c) => s + c.xp, 0) +
      m.encounters.reduce((s, e) => {
        const best = (['fight', 'sneak', 'route'] as const)
          .filter((k) => has(`encounter:${chapterId}:${e.id}:${k}`))
          .map((k) => e.rewards[k]?.xp ?? 0);
        return s + (best.length ? Math.max(...best) : 0);
      }, 0) +
      (has(`mission:${chapterId}`) ? m.completionXp : 0)
    );
  }
}
