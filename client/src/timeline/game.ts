/**
 * Timeline game state: pass-and-play turns on one shared board. Pure logic, no DOM.
 */
import {
  cardsForTier,
  isPlacementCorrect,
  timelineAnchorId,
  timelineEvents,
  type Tier,
  type TimelineEvent,
} from '../../../backend/src/journey/content/timeline';

export interface Player {
  name: string;
  tier: Tier;
  score: number;
  streak: number;
  bestStreak: number;
  correct: number;
  turns: number;
  bonus: number;
  asked: number;
  deck: TimelineEvent[];
}

export interface TurnResult {
  card: TimelineEvent;
  correct: boolean;
  timedOut: boolean;
  points: number;
  multiplier: number;
  timeBonus: number;
}

export const TURN_SECONDS: Record<Tier, number> = { explorer: 45, scholar: 30, historian: 25 };
const BASE: Record<Tier, number> = { explorer: 100, scholar: 120, historian: 150 };
export const BONUS_POINTS = 50;

const sortKey = (e: TimelineEvent) => (e.start + e.end) / 2 + e.start / 10000;
export const chronological = (a: TimelineEvent, b: TimelineEvent) => sortKey(a) - sortKey(b);

function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

export function multiplierFor(streak: number): number {
  return streak >= 4 ? 2 : streak >= 2 ? 1.5 : 1;
}

/** Broad era, shown as an Explorer hint. */
export function eraOf(e: TimelineEvent): 'before' | 'mecca' | 'medina' | 'caliphs' | 'after' {
  const mid = (e.start + e.end) / 2;
  if (mid < 610) return 'before';
  if (mid < 622) return 'mecca';
  if (mid <= 632) return 'medina';
  if (mid <= 653) return 'caliphs';
  return 'after';
}

export class TimelineGame {
  readonly players: Player[];
  readonly board: TimelineEvent[];
  readonly turnsPerPlayer: number;
  readonly timed: boolean;
  current = 0;
  round = 1;
  card: TimelineEvent | null = null;
  readonly history: TurnResult[] = [];

  constructor(setup: { name: string; tier: Tier }[], turnsPerPlayer: number, timed: boolean) {
    this.turnsPerPlayer = turnsPerPlayer;
    this.timed = timed;
    const anchor = timelineEvents.find((e) => e.id === timelineAnchorId)!;
    this.board = [anchor];
    this.players = setup.map((p) => ({
      ...p, score: 0, streak: 0, bestStreak: 0, correct: 0, turns: 0, bonus: 0, asked: 0, deck: shuffle(cardsForTier(p.tier)),
    }));
  }

  get player(): Player { return this.players[this.current]!; }
  get over(): boolean { return this.players.every((p) => p.turns >= this.turnsPerPlayer || !this.hasCards(p)); }

  private hasCards(p: Player): boolean {
    return p.deck.some((c) => !this.board.includes(c));
  }

  /** Draw the next card for the current player (skipping cards already on the board). */
  draw(): TimelineEvent | null {
    const p = this.player;
    while (p.deck.length) {
      const c = p.deck.shift()!;
      if (!this.board.includes(c)) return (this.card = c);
    }
    return (this.card = null);
  }

  /** Place the drawn card at slot `index` (0 = before the first card). */
  place(index: number, secondsLeft: number): TurnResult {
    const card = this.card!;
    const p = this.player;
    const before = this.board[index - 1];
    const after = this.board[index];
    const correct = index >= 0 && isPlacementCorrect(card, before, after, p.tier);
    return this.finish(card, correct, index < 0, secondsLeft);
  }

  timeout(): TurnResult { return this.finish(this.card!, false, true, 0); }

  private finish(card: TimelineEvent, correct: boolean, timedOut: boolean, secondsLeft: number): TurnResult {
    const p = this.player;
    p.turns++;
    if (card.question) p.asked++;
    let points = 0, multiplier = 1, timeBonus = 0;
    if (correct) {
      p.streak++;
      p.correct++;
      p.bestStreak = Math.max(p.bestStreak, p.streak);
      multiplier = multiplierFor(p.streak);
      timeBonus = this.timed ? Math.round((secondsLeft / TURN_SECONDS[p.tier]) * 50) : 0;
      points = Math.round(BASE[p.tier] * multiplier) + timeBonus;
      p.score += points;
    } else {
      p.streak = 0;
    }
    // The card always joins the board in its true place, so the timeline keeps teaching.
    this.board.push(card);
    this.board.sort(chronological);
    const result = { card, correct, timedOut, points, multiplier, timeBonus };
    this.history.push(result);
    this.card = null;
    return result;
  }

  answerBonus(correct: boolean): number {
    if (!correct) return 0;
    this.player.score += BONUS_POINTS;
    this.player.bonus += BONUS_POINTS;
    return BONUS_POINTS;
  }

  /** Move to the next player who still has turns. */
  advance(): void {
    for (let i = 0; i < this.players.length; i++) {
      this.current = (this.current + 1) % this.players.length;
      if (this.current === 0) this.round++;
      const p = this.player;
      if (p.turns < this.turnsPerPlayer && this.hasCards(p)) return;
    }
  }

  ranking(): Player[] {
    return this.players.slice().sort((a, b) => b.score - a.score);
  }
}
