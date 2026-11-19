import { levelForXp } from '../lib/levels.js';
import type { Catalog, Lang } from './content/types.js';
import { deriveSkills, isAreaOpen, maxMissionXp, type Award, type JourneyState } from './engine.js';
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
        return { ...a, name: badge ? badge.name[lang] : a.badgeId };
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
        badges: state.badges.map((id) => {
          const b = this.catalog.badges.find((x) => x.id === id);
          return { badgeId: id, name: b?.name[lang] ?? id, description: b?.description[lang] ?? '' };
        }),
        skills: this.catalog.skills.map((s) => ({ skillId: s.id, name: s.name[lang], level: skills[s.id] ?? 0 })),
      },
      journal: { accounts: journalAccounts, reflections: journalReflections },
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
      (has(`mission:${chapterId}`) ? m.completionXp : 0)
    );
  }
}
