import { z } from 'zod';
import { AppError, badRequest } from '../lib/errors.js';
import type { Catalog, Chapter, Mission, UpgradeId } from './content/types.js';

export interface ChapterProgress {
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  /** Current run. Reset when the chapter is replayed. */
  discoveries: string[];
  puzzles: Record<string, { solved: boolean; attempts: number }>;
  choices: Record<string, string>;
  tasks: Record<string, number>;
  /** Pickups taken this run (they reappear on replay). */
  collectibles: string[];
  /** How each encounter was resolved this run. */
  encounters: Record<string, 'fight' | 'sneak' | 'route'>;
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
  /** Carried items by id (water, provisions, materials, keys). */
  inventory: Record<string, number>;
  /** Upgrade levels: stamina, defense, exploration, capacity. */
  upgrades: Record<string, number>;
  /** Journal fragments ever found, as "chapterId:collectibleId". */
  fragments: string[];
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
  z.object({ type: z.literal('item.collect'), chapterId: z.string(), collectibleId: z.string() }),
  z.object({
    type: z.literal('encounter.resolve'),
    chapterId: z.string(),
    encounterId: z.string(),
    method: z.enum(['fight', 'sneak', 'route']),
  }),
  z.object({
    type: z.literal('upgrade.buy'),
    upgradeId: z.enum(['stamina', 'defense', 'exploration', 'capacity']),
    /** Upgrades are bought at rest points; the chapter is only for the event log. */
    chapterId: z.string().default('global'),
  }),
]);
export type JourneyEvent = z.infer<typeof journeyEventSchema>;

export type Award =
  | { type: 'xp'; amount: number; reason: string }
  | { type: 'badge'; badgeId: string }
  | { type: 'chapter_unlocked'; chapterId: string }
  | { type: 'item'; itemId: string; amount: number };

export interface EventOutcome {
  state: JourneyState;
  awards: Award[];
  /** Event-specific result, e.g. `{ correct: false }` for a wrong puzzle answer. */
  result: Record<string, unknown>;
}

const blocked = (code: string, message: string, details?: unknown) => new AppError(409, code, message, details);

const emptyRun = (): Pick<ChapterProgress, 'discoveries' | 'puzzles' | 'choices' | 'tasks' | 'collectibles' | 'encounters'> => ({
  discoveries: [],
  puzzles: {},
  choices: {},
  tasks: {},
  collectibles: [],
  encounters: {},
});

const emptyUpgrades = (): Record<UpgradeId, number> => ({ stamina: 0, defense: 0, exploration: 0, capacity: 0 });

/** How many of an item the traveler can carry with their current capacity upgrade. */
export function capacityFor(catalog: Catalog, state: JourneyState, itemId: string): number {
  const item = catalog.items.find((i) => i.id === itemId);
  if (!item) return 0;
  return item.baseCapacity + item.capacityPerLevel * (state.upgrades.capacity ?? 0);
}

function addItem(catalog: Catalog, state: JourneyState, itemId: string, amount: number): number {
  const have = state.inventory[itemId] ?? 0;
  const added = Math.max(0, Math.min(amount, capacityFor(catalog, state, itemId) - have));
  state.inventory[itemId] = have + added;
  return added;
}

function hasItems(state: JourneyState, items: Record<string, number> | undefined): boolean {
  return Object.entries(items ?? {}).every(([id, n]) => (state.inventory[id] ?? 0) >= n);
}

function takeItems(state: JourneyState, items: Record<string, number> | undefined) {
  for (const [id, n] of Object.entries(items ?? {})) state.inventory[id] = (state.inventory[id] ?? 0) - n;
}

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
  return {
    catalogVersion: catalog.version,
    chapters,
    collected: [],
    badges: [],
    claimed: [],
    xp: 0,
    inventory: {},
    upgrades: emptyUpgrades(),
    fragments: [],
  };
}

/** Add chapters introduced by newer catalog versions without touching existing progress. */
export function upgradeState(catalog: Catalog, state: JourneyState): JourneyState {
  if (state.catalogVersion === catalog.version && catalog.chapters.every((c) => state.chapters[c.id])) return state;
  const fresh = initialState(catalog);
  const next = structuredClone(state);
  for (const [id, progress] of Object.entries(fresh.chapters)) next.chapters[id] ??= progress;
  for (const p of Object.values(next.chapters)) Object.assign(p, { ...emptyRun(), ...p });
  next.inventory ??= {};
  next.upgrades = { ...emptyUpgrades(), ...next.upgrades };
  next.fragments ??= [];
  // A chapter inserted into the order (e.g. Ghifar) opens if the one before it is done.
  const ordered = [...catalog.chapters].sort((a, b) => a.order - b.order);
  ordered.forEach((c, i) => {
    const prev = ordered[i - 1];
    if (prev && next.chapters[c.id]!.status === 'locked' && next.chapters[prev.id]!.timesCompleted > 0) {
      next.chapters[c.id]!.status = 'available';
    }
  });
  next.catalogVersion = catalog.version;
  return next;
}

export function isAreaOpen(mission: Mission, progress: ChapterProgress, areaId: string): boolean {
  const area = mission.areas.find((a) => a.id === areaId);
  if (!area) return false;
  if (area.unlockedBy && progress.puzzles[area.unlockedBy]?.solved !== true) return false;
  if (area.unlockedByEncounter && !progress.encounters?.[area.unlockedByEncounter]) return false;
  return true;
}

/** Apply one player action. Pure: returns a new state and never mutates the input. */
export function applyEvent(catalog: Catalog, current: JourneyState, event: JourneyEvent): EventOutcome {
  const state = structuredClone(current);
  const awards: Award[] = [];

  if (event.type === 'upgrade.buy') return buyUpgrade(catalog, state, event.upgradeId);

  const chapter = catalog.chapters.find((c) => c.id === event.chapterId);
  if (!chapter) throw badRequest(`Unknown chapter "${event.chapterId}"`);
  const progress = state.chapters[chapter.id]!;
  const mission = chapter.mission;
  if (progress.status === 'locked') throw blocked('chapter_locked', 'Complete the previous chapter first');

  const claim = (key: string, xp: number, reason: string, badgeId?: string, items?: Record<string, number>) => {
    if (state.claimed.includes(key)) return;
    for (const [id, n] of Object.entries(items ?? {})) {
      const added = addItem(catalog, state, id, n);
      if (added > 0) awards.push({ type: 'item', itemId: id, amount: added });
    }
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
      claim(`discovery:${key}`, d.xp, 'discovery', d.badge);
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
        p.kind === 'mechanism'
          ? event.answer.length === 1 && event.answer[0] === 'solved'
          : event.answer.length === p.solution.length && event.answer.every((id, i) => id === p.solution[i]);
      if (correct) {
        record.solved = true;
        claim(`puzzle:${chapter.id}:${p.id}`, p.xp, 'puzzle');
        const opened = mission.areas.filter((a) => a.unlockedBy === p.id).map((a) => a.id);
        result = { correct: true, attempts: record.attempts, openedAreas: opened };
      } else {
        // How many leading symbols were right, so the UI can give gentle feedback.
        let prefix = 0;
        const solution = p.kind === 'mechanism' ? [] : p.solution;
        while (prefix < event.answer.length && event.answer[prefix] === solution[prefix]) prefix++;
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
      const before = progress.tasks[t.id] ?? 0;
      const amount = Math.min(event.amount, t.goal - before);
      if (amount <= 0) {
        result = { count: before, goal: t.goal, complete: true };
        break;
      }
      const cost = Object.fromEntries(Object.entries(t.consumes ?? {}).map(([id, n]) => [id, n * amount]));
      if (!hasItems(state, cost)) throw blocked('missing_items', 'You do not have what is needed', { needs: cost });
      takeItems(state, cost);
      const count = before + amount;
      progress.tasks[t.id] = count;
      if (count >= t.goal) claim(`task:${chapter.id}:${t.id}`, t.xp, 'optional_task', t.badge, t.rewards);
      result = { count, goal: t.goal, complete: count >= t.goal };
      break;
    }

    case 'mission.complete': {
      editable();
      const unsolved = mission.completionRequiresPuzzles.filter((id) => !progress.puzzles[id]?.solved);
      const unchosen = mission.choices.filter((c) => c.requiredForCompletion && !progress.choices[c.id]);
      const unresolved = mission.encounters.filter((e) => e.requiredForCompletion && !progress.encounters[e.id]);
      const undiscovered = mission.completionRequiresDiscoveries.filter((d) => !progress.discoveries.includes(d));
      if (unsolved.length || unchosen.length || unresolved.length || undiscovered.length) {
        throw new AppError(409, 'prerequisites_missing', 'The mission is not finished yet', {
          puzzles: unsolved,
          choices: unchosen.map((c) => c.id),
          encounters: unresolved.map((e) => e.id),
          discoveries: undiscovered,
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

    case 'item.collect': {
      const c = mission.collectibles.find((x) => x.id === event.collectibleId);
      if (!c) throw badRequest(`Unknown collectible "${event.collectibleId}"`);
      requireArea(c.areaId);
      if (progress.status === 'available') progress.status = 'in_progress';
      if (progress.collectibles.includes(c.id)) {
        result = { alreadyCollected: true };
        break;
      }
      if (c.item === 'fragment') {
        progress.collectibles.push(c.id);
        const key = `${chapter.id}:${c.id}`;
        if (!state.fragments.includes(key)) state.fragments.push(key);
        claim(`fragment:${key}`, c.xp, 'fragment');
        result = { fragment: true };
        break;
      }
      const added = addItem(catalog, state, c.item, c.amount);
      if (added === 0) {
        // Bags full: leave it in the world so the player can come back for it.
        result = { added: 0, full: true, capacity: capacityFor(catalog, state, c.item) };
        break;
      }
      progress.collectibles.push(c.id);
      claim(`collect:${chapter.id}:${c.id}`, c.xp, 'collect');
      result = { added, itemId: c.item, total: state.inventory[c.item] };
      break;
    }

    case 'encounter.resolve': {
      const e = mission.encounters.find((x) => x.id === event.encounterId);
      if (!e) throw badRequest(`Unknown encounter "${event.encounterId}"`);
      if (!e.methods.includes(event.method)) throw badRequest(`"${event.method}" is not a way through here`);
      requireArea(e.areaId);
      if (progress.status === 'available') progress.status = 'in_progress';
      if (progress.encounters[e.id]) {
        result = { alreadyResolved: true, method: progress.encounters[e.id] };
        break;
      }
      const needs = e.requires?.[event.method];
      if (!hasItems(state, needs)) throw blocked('missing_items', 'You need something to go this way', { needs });
      progress.encounters[e.id] = event.method;
      const reward = e.rewards[event.method];
      // Each approach pays once, so replaying a chapter a different way is still rewarding.
      claim(`encounter:${chapter.id}:${e.id}:${event.method}`, reward?.xp ?? 0, `encounter_${event.method}`, undefined, reward?.items);
      const opened = mission.areas.filter((a) => a.unlockedByEncounter === e.id).map((a) => a.id);
      result = { method: event.method, openedAreas: opened };
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

function buyUpgrade(catalog: Catalog, state: JourneyState, upgradeId: UpgradeId): EventOutcome {
  const upgrade = catalog.upgrades.find((u) => u.id === upgradeId);
  if (!upgrade) throw badRequest(`Unknown upgrade "${upgradeId}"`);
  const level = state.upgrades[upgradeId] ?? 0;
  const cost = upgrade.costs[level];
  if (!cost) throw blocked('max_level', 'This is already at its highest level');
  if (!hasItems(state, cost)) throw blocked('missing_items', 'Not enough materials', { needs: cost });
  takeItems(state, cost);
  state.upgrades[upgradeId] = level + 1;
  return { state, awards: [], result: { upgradeId, level: level + 1 } };
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
  m.tasks.reduce((s, t) => s + t.xp, 0) +
  m.collectibles.reduce((s, c) => s + c.xp, 0) +
  // One way through each encounter per run: count the best-paying method.
  m.encounters.reduce((s, e) => s + Math.max(0, ...Object.values(e.rewards).map((r) => r?.xp ?? 0)), 0);
