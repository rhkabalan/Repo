import type { FastifyBaseLogger } from 'fastify';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import type { GameDefinition, GameEvent } from '../games/types.js';
import type { Catalog } from './content/types.js';
import { applyEvent, initialState, isAreaOpen, type JourneyEvent, type JourneyState } from './engine.js';
import type { JourneyService } from './service.js';

/**
 * ATHAR together: 1–3 players explore the same chapter in real time.
 *
 * - The world is shared: a discovery, a solved puzzle or a water delivery by anyone counts
 *   for the whole party, and areas open for everyone together.
 * - Choices are personal: each player picks their own guide approach and journal emphasis,
 *   because the journal is theirs.
 * - Every accepted action is written straight to each member's own journey, so XP, badges
 *   and unlocks land on every account, and leaving early keeps what was earned.
 */

export const COOP_GAME_ID = 'athar-journey';

const options = z.object({ chapterId: z.string().min(1).max(64) });
type Options = z.infer<typeof options>;

/** Actions are journey events without `chapterId` (the room's chapter is implied). */
const actionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('discovery.find'), discoveryId: z.string() }),
  z.object({ type: z.literal('puzzle.attempt'), puzzleId: z.string(), answer: z.array(z.string()).min(1).max(20) }),
  z.object({ type: z.literal('task.progress'), taskId: z.string(), amount: z.number().int().min(1).max(10) }),
  z.object({ type: z.literal('choice.make'), choiceId: z.string(), optionId: z.string() }),
  z.object({ type: z.literal('mission.complete') }),
]);

const inputSchema = z.discriminatedUnion('kind', [
  /** Where the player's character is. Movement itself is simulated on the client. */
  z.object({
    kind: z.literal('move'),
    areaId: z.string().max(64),
    x: z.number().finite().min(-100_000).max(100_000),
    y: z.number().finite().min(-100_000).max(100_000),
    facing: z.enum(['left', 'right', 'up', 'down']).optional(),
    anim: z.enum(['idle', 'walk', 'run', 'talk', 'carry', 'interact']).optional(),
  }),
  z.object({ kind: z.literal('action'), action: actionSchema }),
]);
type Input = z.infer<typeof inputSchema>;

interface Member {
  id: string;
  areaId: string;
  x: number;
  y: number;
  facing: string;
  anim: string;
  choices: Record<string, string>;
  active: boolean;
  xpEarned: number;
}

interface CoopState {
  chapterId: string;
  run: JourneyState;
  members: Map<string, Member>;
  outbox: GameEvent[];
  /** Serializes persistence so each member's journey sees events in order. */
  persisting: Promise<void>;
  completed: boolean;
  persisted: boolean;
}

export function createCoopJourney(
  catalog: Catalog,
  journey: JourneyService,
  log: FastifyBaseLogger,
): GameDefinition<CoopState, Input> {
  const chapterOf = (id: string) => {
    const c = catalog.chapters.find((x) => x.id === id);
    if (!c) throw new AppError(400, 'bad_options', `Unknown chapter "${id}"`);
    return c;
  };

  /** Persist one event for the given members, in order, reporting their awards back to them. */
  function persist(state: CoopState, userIds: string[], event: JourneyEvent) {
    state.persisting = state.persisting.then(async () => {
      for (const userId of userIds) {
        try {
          const { awards } = await journey.applyRaw(userId, event);
          if (awards.length) {
            const xp = awards.reduce((s, a) => (a.type === 'xp' ? s + a.amount : s), 0);
            const m = state.members.get(userId);
            if (m) m.xpEarned += xp;
            state.outbox.push({ type: 'journey.awards', playerId: userId, awards });
          }
        } catch (err) {
          // A member's own journey may already be ahead (e.g. found this earlier). That's fine.
          log.debug({ err, userId, event }, 'co-op event not applied to member journey');
        }
      }
    });
  }

  const reject = (state: CoopState, playerId: string, code: string, message: string, details?: unknown) =>
    state.outbox.push({ type: 'action.rejected', playerId, code, message, ...(details ? { details } : {}) });

  return {
    id: COOP_GAME_ID,
    name: 'ATHAR — Journey together',
    description: 'Explore a chapter of Abu Dharr’s journey with up to two friends.',
    modes: ['solo', 'multiplayer'],
    minPlayers: 1,
    maxPlayers: 3,
    tickRate: 10,
    cooperative: true,
    matchmaking: false,
    optionsSchema: options,
    inputSchema,

    async beforeStart(playerIds, raw) {
      const { chapterId } = raw as Options;
      chapterOf(chapterId);
      await journey.prepareParty(playerIds, chapterId);
    },

    createState(playerIds, _rng, raw) {
      const { chapterId } = raw as Options;
      const chapter = chapterOf(chapterId);
      // The party's shared run starts fresh, with the chapter open.
      const run = initialState(catalog);
      run.chapters[chapterId]!.status = 'in_progress';
      const firstArea = chapter.mission.areas[0]?.id ?? '';
      const members = new Map<string, Member>();
      for (const id of playerIds) {
        members.set(id, { id, areaId: firstArea, x: 0, y: 0, facing: 'right', anim: 'idle', choices: {}, active: true, xpEarned: 0 });
      }
      return { chapterId, run, members, outbox: [], persisting: Promise.resolve(), completed: false, persisted: false };
    },

    applyInput(state, playerId, input) {
      const me = state.members.get(playerId);
      if (!me?.active || state.completed) return;
      const chapter = chapterOf(state.chapterId);
      const progress = state.run.chapters[state.chapterId]!;

      if (input.kind === 'move') {
        if (!isAreaOpen(chapter.mission, progress, input.areaId)) return; // can't walk into a closed area
        Object.assign(me, {
          areaId: input.areaId,
          x: input.x,
          y: input.y,
          facing: input.facing ?? me.facing,
          anim: input.anim ?? me.anim,
        });
        return;
      }

      const action = input.action;
      const event = { ...action, chapterId: state.chapterId } as JourneyEvent;
      const everyone = [...state.members.values()].filter((m) => m.active).map((m) => m.id);

      if (action.type === 'choice.make') {
        try {
          applyEvent(catalog, state.run, event); // validates option + prerequisites only
        } catch (err) {
          const e = err as AppError;
          return reject(state, playerId, e.code, e.message);
        }
        me.choices[action.choiceId] = action.optionId;
        state.outbox.push({ type: 'choice.made', playerId, choiceId: action.choiceId, optionId: action.optionId });
        persist(state, [playerId], event);
        return;
      }

      if (action.type === 'mission.complete') {
        const mission = chapter.mission;
        const unsolved = mission.completionRequiresPuzzles.filter((id) => !progress.puzzles[id]?.solved);
        const waitingOn = [...state.members.values()]
          .filter((m) => m.active)
          .flatMap((m) =>
            mission.choices
              .filter((c) => c.requiredForCompletion && !m.choices[c.id])
              .map((c) => ({ playerId: m.id, choiceId: c.id })),
          );
        if (unsolved.length || waitingOn.length) {
          return reject(state, playerId, 'prerequisites_missing', 'The party has not finished the mission yet', {
            puzzles: unsolved,
            choices: waitingOn,
          });
        }
        state.completed = true;
        state.outbox.push({ type: 'mission.completed', by: playerId });
        persist(state, everyone, event);
        void state.persisting.then(() => (state.persisted = true));
        return;
      }

      // Shared world actions.
      let outcome;
      try {
        outcome = applyEvent(catalog, state.run, event);
      } catch (err) {
        const e = err as AppError;
        return reject(state, playerId, e.code, e.message);
      }
      const already =
        (action.type === 'discovery.find' && progress.discoveries.includes(action.discoveryId)) ||
        (action.type === 'puzzle.attempt' && progress.puzzles[action.puzzleId]?.solved);
      state.run = outcome.state;
      state.outbox.push({ ...action, playerId, result: outcome.result });
      // Wrong answers stay in the party run; only meaningful progress is written to journeys.
      const meaningful = !already && (action.type !== 'puzzle.attempt' || outcome.result.correct === true);
      if (meaningful) persist(state, everyone, event);
    },

    tick(state) {
      return state.outbox.splice(0, state.outbox.length);
    },

    removePlayer(state, playerId) {
      const m = state.members.get(playerId);
      if (m) m.active = false;
    },

    isOver(state) {
      return state.completed && state.persisted;
    },

    results(state) {
      // Co-operative: the party shares first place; score = XP each member earned this run.
      return [...state.members.values()].map((m) => ({ userId: m.id, score: m.xpEarned, placement: 1 }));
    },

    snapshot(state, viewerId) {
      const chapter = chapterOf(state.chapterId);
      const p = state.run.chapters[state.chapterId]!;
      return {
        chapterId: state.chapterId,
        openAreas: chapter.mission.areas.filter((a) => isAreaOpen(chapter.mission, p, a.id)).map((a) => a.id),
        discoveries: p.discoveries,
        puzzles: p.puzzles,
        tasks: p.tasks,
        completed: state.completed,
        players: [...state.members.values()].map((m) => ({
          id: m.id,
          active: m.active,
          areaId: m.areaId,
          x: Math.round(m.x),
          y: Math.round(m.y),
          facing: m.facing,
          anim: m.anim,
          // Others see which choices you've made, not what you picked.
          choicesMade: Object.keys(m.choices),
          ...(m.id === viewerId ? { choices: m.choices } : {}),
          xpEarned: m.xpEarned,
        })),
      };
    },

    xpFor() {
      return 0; // XP is already credited through each member's journey.
    },
  };
}
