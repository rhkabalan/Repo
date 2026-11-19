import { api, type ApiError } from './api';
import type { Realtime, ServerMsg } from './realtime';

/** The party's (or solo player's) progress through the current chapter run. */
export interface RunState {
  discoveries: string[];
  puzzles: Record<string, { solved: boolean; attempts: number }>;
  tasks: Record<string, number>;
  openAreas: string[];
  choices: Record<string, string>;
  completed: boolean;
}

export type Action =
  | { type: 'discovery.find'; discoveryId: string }
  | { type: 'puzzle.attempt'; puzzleId: string; answer: string[] }
  | { type: 'task.progress'; taskId: string; amount: number }
  | { type: 'choice.make'; choiceId: string; optionId: string }
  | { type: 'mission.complete' };

export type Award = { type: 'xp'; amount: number; reason: string } | { type: 'badge'; badgeId: string; name?: string } | { type: 'chapter_unlocked'; chapterId: string };

export type ActOutcome =
  | { ok: true; result: Record<string, any> }
  | { ok: false; code: string; message: string; details?: any };

export interface RemotePlayer {
  id: string;
  areaId: string;
  x: number;
  y: number;
  facing: string;
  anim: string;
  active: boolean;
  choicesMade: string[];
  xpEarned: number;
}

export interface MissionDriver {
  readonly mode: 'solo' | 'party';
  readonly chapterId: string;
  state: RunState;
  earnedXp: number;
  act(action: Action): Promise<ActOutcome>;
  onAwards(fn: (awards: Award[]) => void): void;
  onChange(fn: (state: RunState) => void): void;
  onPlayers?(fn: (players: RemotePlayer[]) => void): void;
  sendMove?(m: { areaId: string; x: number; y: number; facing: string; anim: string }): void;
  dispose(): void;
}

const emptyRun = (): RunState => ({ discoveries: [], puzzles: {}, tasks: {}, openAreas: [], choices: {}, completed: false });

/** Single player via the REST journey API. */
export class SoloDriver implements MissionDriver {
  readonly mode = 'solo' as const;
  state = emptyRun();
  earnedXp = 0;
  private awardFns: ((a: Award[]) => void)[] = [];
  private changeFns: ((s: RunState) => void)[] = [];

  constructor(readonly chapterId: string) {}

  /** Load the player's saved progress (resumes an in-progress run on any device). */
  async init(): Promise<void> {
    const j = await api.get<{ chapters: any[] }>('/v1/journey');
    this.absorb(j);
  }

  private absorb(journey: { chapters: any[] }) {
    const c = journey.chapters.find((x) => x.chapterId === this.chapterId);
    if (!c) return;
    this.state = {
      discoveries: c.discoveries,
      puzzles: c.puzzles,
      tasks: c.tasks,
      openAreas: c.openAreas,
      choices: c.choices,
      completed: c.status === 'completed',
    };
    this.earnedXp = c.earnedXp;
    for (const fn of this.changeFns) fn(this.state);
  }

  async act(action: Action): Promise<ActOutcome> {
    try {
      const res = await api.post<{ result: Record<string, any>; awards: Award[]; journey: { chapters: any[] } }>('/v1/journey/events', {
        ...action,
        chapterId: this.chapterId,
      });
      this.absorb(res.journey);
      if (res.awards.length) for (const fn of this.awardFns) fn(res.awards);
      return { ok: true, result: res.result };
    } catch (e) {
      const err = e as ApiError;
      return { ok: false, code: err.code ?? 'error', message: err.message ?? 'Error', details: err.details };
    }
  }

  async replay() {
    await api.post('/v1/journey/events', { type: 'chapter.replay', chapterId: this.chapterId });
    await this.init();
  }

  onAwards(fn: (a: Award[]) => void) {
    this.awardFns.push(fn);
  }
  onChange(fn: (s: RunState) => void) {
    this.changeFns.push(fn);
  }
  dispose() {}
}

/** 2–3 player co-op through a real-time room. */
export class PartyDriver implements MissionDriver {
  readonly mode = 'party' as const;
  state = emptyRun();
  earnedXp = 0;
  private awardFns: ((a: Award[]) => void)[] = [];
  private changeFns: ((s: RunState) => void)[] = [];
  private playerFns: ((p: RemotePlayer[]) => void)[] = [];
  private pending: { type: string; resolve: (o: ActOutcome) => void; timer: ReturnType<typeof setTimeout> }[] = [];
  private off: () => void;
  private lastMove = 0;

  constructor(
    private readonly rt: Realtime,
    readonly chapterId: string,
  ) {
    this.off = rt.on((m) => this.onMessage(m));
  }

  private settle(type: string, outcome: ActOutcome) {
    const i = this.pending.findIndex((p) => p.type === type || type === '*');
    if (i < 0) return;
    const [p] = this.pending.splice(i, 1);
    clearTimeout(p!.timer);
    p!.resolve(outcome);
  }

  private onMessage(m: ServerMsg) {
    const me = this.rt.userId;
    if (m.t === 'game.state') {
      const s = m.state;
      const mine = s.players.find((p: RemotePlayer) => p.id === me);
      this.state = {
        discoveries: s.discoveries,
        puzzles: s.puzzles,
        tasks: s.tasks,
        openAreas: s.openAreas,
        choices: mine?.choices ?? {},
        completed: s.completed,
      };
      this.earnedXp = mine?.xpEarned ?? 0;
      for (const fn of this.changeFns) fn(this.state);
      for (const fn of this.playerFns) fn(s.players.filter((p: RemotePlayer) => p.id !== me));
      return;
    }
    if (m.t !== 'game.event') return;
    const e = m.event;
    if (e.type === 'journey.awards' && e.playerId === me) {
      for (const fn of this.awardFns) fn(e.awards);
    } else if (e.type === 'action.rejected' && e.playerId === me) {
      this.settle('*', { ok: false, code: e.code, message: e.message, details: e.details });
    } else if (e.playerId === me || e.by === me) {
      const type = e.type === 'choice.made' ? 'choice.make' : e.type === 'mission.completed' ? 'mission.complete' : e.type;
      this.settle(type, { ok: true, result: e.result ?? {} });
    }
  }

  act(action: Action): Promise<ActOutcome> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => this.settle(action.type, { ok: false, code: 'timeout', message: 'No response from the server' }), 8000);
      this.pending.push({ type: action.type, resolve, timer });
      this.rt.input({ kind: 'action', action });
    });
  }

  sendMove(m: { areaId: string; x: number; y: number; facing: string; anim: string }) {
    const now = performance.now();
    if (now - this.lastMove < 100) return; // 10 Hz
    this.lastMove = now;
    this.rt.input({ kind: 'move', ...m });
  }

  onAwards(fn: (a: Award[]) => void) {
    this.awardFns.push(fn);
  }
  onChange(fn: (s: RunState) => void) {
    this.changeFns.push(fn);
  }
  onPlayers(fn: (p: RemotePlayer[]) => void) {
    this.playerFns.push(fn);
  }
  dispose() {
    this.off();
  }
}
