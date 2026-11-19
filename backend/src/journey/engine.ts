import { z } from 'zod';
import { AppError, badRequest } from '../lib/errors.js';
import type { Catalog, Chapter, Mission } from './content/types.js';

export interface ChapterProgress {
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  /** Current run. Reset when the chapter is replayed. */
  discoveries: string[];
  puzzles: Record<string, { solved: boolean; attempts: number }>;
  choices: Record<string, string>;
  tasks: Record<string, number>;
  /** Choices locked in at the last completion; these drive the journal and skills. */
  committedChoices: Record<string, string>;
  timesCompleted: number;
  completedAt: string | null;
}

export interface JourneyState {
  catalogVersion: number;
  chapters: Record<string, ChapterProgress>;
  /** Every account ever collected (kept across replays), as "chapterId:discoveryId". */
  collected: string[];
  badges: string[];
  /** Reward keys already paid out, so replays and retries can never farm XP. */
  claimed: string[];
  xp: number;
}

export const journeyEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('chapter.start'), chapterId: z.string() }),
  z.object({ type: z.literal('discovery.find'), chapterId: z.string(), discoveryId: z.string() }),
  z.object({
    type: z.literal('puzzle.attempt'),
    chapterId: z.string(),
    puzzleId: z.string(),
    answer: z.array(z.string()).min(1).max(20),
  }),
  z.object({ type: z.literal('choice.make'), chapterId: z.string(), choiceId: z.string(), optionId: z.string() }),
  z.object({ type: z.literal('task.progress'), chapterId: z.string(), taskId: z.string(), amount: z.number().int().min(1).max(10) }),
  z.object({ type: z.literal('mission.complete'), chapterId: z.string() }),
  z.object({ type: z.literal('chapter.replay'), chapterId: z.string() }),
]);
export type JourneyEvent = z.infer<typeof journeyEventSchema>;

export type Award =
  | { type: 'xp'; amount: number; reason: string }
  | { type: 'badge'; badgeId: string }
  | { type: 'chapter_unlocked'; chapterId: string };

export interface EventOutcome {
  state: JourneyState;
  awards: Award[];
  /** Event-specific result, e.g. `{ correct: false }` for a wrong puzzle answer. */
  result: Record<string, unknown>;
}

const blocked = (code: string, message: string) => new AppError(409, code, message);

const emptyRun = (): Pick<ChapterProgress, 'discoveries' | 'puzzles' | 'choices' | 'tasks'> => ({
  discoveries: [],
  puzzles: {},
  choices: {},
  tasks: {},
});

export function initialState(catalog: Catalog): JourneyState {
  const chapters: Record<string, ChapterProgress> = {};
  for (const c of [...catalog.chapters].sort((a, b) => a.order - b.order)) {
    chapters[c.id] = {
      status: c.order === 1 ? 'available' : 'locked',
      ...emptyRun(),
      committedChoices: {},
      timesCompleted: 0,
      completedAt: null,
    };
  }
  return { catalogVersion: catalog.version, chapters, collected: [], badges: [], claimed: [], xp: 0 };
}

/** Add chapters introduced by newer catalog versions without touching existing progress. */
export function upgradeState(catalog: Catalog, state: JourneyState): JourneyState {
  if (state.catalogVersion === catalog.version && catalog.chapters.every((c) => state.chapters[c.id])) return state;
  const fresh = initialState(catalog);
  const next = structuredClone(state);
  for (const [id, progress] of Object.entries(fresh.chapters)) next.chapters[id] ??= progress;
  next.catalogVersion = catalog.version;
  return next;
}

export function isAreaOpen(mission: Mission, progress: ChapterProgress, areaId: string): boolean {
  const area = mission.areas.find((a) => a.id === areaId);
  if (!area) return false;
  return !area.unlockedBy || progress.puzzles[area.unlockedBy]?.solved === true;
}

/** Apply one player action. Pure: returns a new state and never mutates the input. */
export function applyEvent(catalog: Catalog, current: JourneyState, event: JourneyEvent): EventOutcome {
  const state = structuredClone(current);
  const awards: Award[] = [];

  const chapter = catalog.chapters.find((c) => c.id === event.chapterId);
  if (!chapter) throw badRequest(`Unknown chapter "${event.chapterId}"`);
  const progress = state.chapters[chapter.id]!;
  const mission = chapter.mission;
  if (progress.status === 'locked') throw blocked('chapter_locked', 'Complete the previous chapter first');

  const claim = (key: string, xp: number, reason: string, badgeId?: string) => {
    if (state.claimed.includes(key)) return;
    state.claimed.push(key);
    if (xp > 0) {
      state.xp += xp;
      awards.push({ type: 'xp', amount: xp, reason });
    }
    if (badgeId && !state.badges.includes(badgeId)) {
      state.badges.push(badgeId);
      awards.push({ type: 'badge', badgeId });
    }
  };

  const requireArea = (areaId: string) => {
    if (!isAreaOpen(mission, progress, areaId)) throw blocked('area_locked', 'That area is not open yet');
  };

  const editable = () => {
    if (progress.status === 'completed') {
      throw blocked('chapter_completed', 'This chapter is complete. Replay it to make different choices.');
    }
    if (progress.status === 'available') progress.status = 'in_progress';
  };

  let result: Record<string, unknown> = {};

  switch (event.type) {
    case 'chapter.start': {
      if (progress.status === 'available') progress.status = 'in_progress';
      break;
    }

    case 'discovery.find': {
      const d = mission.discoveries.find((x) => x.id === event.discoveryId);
      if (!d) throw badRequest(`Unknown discovery "${event.discoveryId}"`);
      requireArea(d.areaId);
      if (progress.status === 'available') progress.status = 'in_progress';
      if (!progress.discoveries.includes(d.id)) progress.discoveries.push(d.id);
      const key = `${chapter.id}:${d.id}`;
      if (!state.collected.includes(key)) state.collected.push(key);
      claim(`discovery:${key}`, d.xp, 'discovery');
      break;
    }

    case 'puzzle.attempt': {
      const p = mission.puzzles.find((x) => x.id === event.puzzleId);
      if (!p) throw badRequest(`Unknown puzzle "${event.puzzleId}"`);
      requireArea(p.areaId);
      const missing = p.requiresDiscoveries.filter((d) => !progress.discoveries.includes(d));
      if (missing.length) throw blocked('prerequisites_missing', 'Find the related accounts first');
      const record = (progress.puzzles[p.id] ??= { solved: false, attempts: 0 });
      if (record.solved) {
        result = { correct: true, alreadySolved: true };
        break;
      }
      if (progress.status === 'available') progress.status = 'in_progress';
      record.attempts++;
      const correct =
        event.answer.length === p.solution.length && event.answer.every((id, i) => id === p.solution[i]);
      if (correct) {
        record.solved = true;
        claim(`puzzle:${chapter.id}:${p.id}`, p.xp, 'puzzle');
        const opened = mission.areas.filter((a) => a.unlockedBy === p.id).map((a) => a.id);
        result = { correct: true, attempts: record.attempts, openedAreas: opened };
      } else {
        // How many leading symbols were right, so the UI can give gentle feedback.
        let prefix = 0;
        while (prefix < event.answer.length && event.answer[prefix] === p.solution[prefix]) prefix++;
        result = { correct: false, attempts: record.attempts, correctPrefix: prefix };
      }
      break;
    }

    case 'choice.make': {
      const c = mission.choices.find((x) => x.id === event.choiceId);
      if (!c) throw badRequest(`Unknown choice "${event.choiceId}"`);
      if (!c.options.some((o) => o.id === event.optionId)) throw badRequest(`Unknown option "${event.optionId}"`);
      if (c.requiresPuzzle && !progress.puzzles[c.requiresPuzzle]?.solved) {
        throw blocked('prerequisites_missing', 'Solve the puzzle first');
      }
      editable();
      progress.choices[c.id] = event.optionId;
      break;
    }

    case 'task.progress': {
      const t = mission.tasks.find((x) => x.id === event.taskId);
      if (!t) throw badRequest(`Unknown task "${event.taskId}"`);
      if (progress.status === 'available') progress.status = 'in_progress';
      const count = Math.min(t.goal, (progress.tasks[t.id] ?? 0) + event.amount);
      progress.tasks[t.id] = count;
      if (count >= t.goal) claim(`task:${chapter.id}:${t.id}`, t.xp, 'optional_task', t.badge);
      result = { count, goal: t.goal, complete: count >= t.goal };
      break;
    }

    case 'mission.complete': {
      editable();
      const unsolved = mission.completionRequiresPuzzles.filter((id) => !progress.puzzles[id]?.solved);
      const unchosen = mission.choices.filter((c) => c.requiredForCompletion && !progress.choices[c.id]);
      if (unsolved.length || unchosen.length) {
        throw new AppError(409, 'prerequisites_missing', 'The mission is not finished yet', {
          puzzles: unsolved,
          choices: unchosen.map((c) => c.id),
        });
      }
      progress.status = 'completed';
      progress.completedAt = new Date().toISOString();
      progress.timesCompleted++;
      progress.committedChoices = { ...progress.choices };
      claim(`mission:${chapter.id}`, mission.completionXp, 'mission_complete', mission.completionBadge);
      const next = nextChapter(catalog, chapter);
      if (next && state.chapters[next.id]!.status === 'locked') {
        state.chapters[next.id]!.status = 'available';
        awards.push({ type: 'chapter_unlocked', chapterId: next.id });
      }
      break;
    }

    case 'chapter.replay': {
      if (progress.status !== 'completed') throw blocked('not_completed', 'Only completed chapters can be replayed');
      Object.assign(progress, emptyRun(), { status: 'in_progress' });
      break;
    }
  }

  return { state, awards, result };
}

function nextChapter(catalog: Catalog, chapter: Chapter): Chapter | undefined {
  return [...catalog.chapters].sort((a, b) => a.order - b.order).find((c) => c.order > chapter.order);
}

/** Skill levels come from the choices committed in completed chapters. */
export function deriveSkills(catalog: Catalog, state: JourneyState): Record<string, number> {
  const skills: Record<string, number> = Object.fromEntries(catalog.skills.map((s) => [s.id, 0]));
  for (const chapter of catalog.chapters) {
    const committed = state.chapters[chapter.id]?.committedChoices ?? {};
    for (const choice of chapter.mission.choices) {
      const option = choice.options.find((o) => o.id === committed[choice.id]);
      for (const [skill, delta] of Object.entries(option?.skills ?? {})) skills[skill] = (skills[skill] ?? 0) + delta;
    }
  }
  return skills;
}

/** The highest XP a mission can award, for progress bars. */
export const maxMissionXp = (m: Mission) =>
  m.completionXp +
  m.discoveries.reduce((s, d) => s + d.xp, 0) +
  m.puzzles.reduce((s, p) => s + p.xp, 0) +
  m.tasks.reduce((s, t) => s + t.xp, 0);
