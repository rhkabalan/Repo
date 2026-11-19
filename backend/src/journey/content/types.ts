/** Every player-facing string ships in both languages. Arabic is the primary language. */
export interface LocalizedText {
  ar: string;
  en: string;
}

export type Lang = keyof LocalizedText;

/**
 * How a piece of content relates to the historical record. The game must never present
 * fictional gameplay as history, and missing details must not be invented.
 */
export type Certainty =
  /** Backed by an identified source (see `sources`). */
  | 'sourced'
  /** Historical, but the detail is unresolved or disputed. */
  | 'uncertain'
  /** Invented for gameplay; the UI labels it as such. */
  | 'fictional';

/** Editorial state of the text, for the scholarly and Arabic-language review. */
export type ReviewStatus = 'draft' | 'in_review' | 'approved';

export interface SourceRef {
  id: string;
  citation: LocalizedText;
  url?: string;
  note?: LocalizedText;
}

export interface ContentMeta {
  certainty: Certainty;
  review: ReviewStatus;
  /** Internal note for writers and reviewers; never shown to players. */
  editorNote?: string;
}

export interface Skill {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
}

export interface Badge {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
}

export interface Area {
  id: string;
  name: LocalizedText;
  /** A puzzle that must be solved before entering, if any. */
  unlockedBy?: string;
  meta: ContentMeta;
}

export interface Discovery {
  id: string;
  areaId: string;
  title: LocalizedText;
  body: LocalizedText;
  sources: SourceRef[];
  xp: number;
  meta: ContentMeta;
}

export interface PuzzleOption {
  id: string;
  label: LocalizedText;
}

/** Arrange or select options in the correct order. The solution never leaves the server. */
export interface SequencePuzzle {
  id: string;
  kind: 'sequence';
  areaId: string;
  prompt: LocalizedText;
  options: PuzzleOption[];
  solution: string[];
  /** Discoveries the player must have found before attempting. */
  requiresDiscoveries: string[];
  xp: number;
  meta: ContentMeta;
}

export type Puzzle = SequencePuzzle;

export interface ChoiceOption {
  id: string;
  label: LocalizedText;
  /** Journal text recorded when this option is chosen. */
  journal?: LocalizedText;
  skills?: Record<string, number>;
}

export interface Choice {
  id: string;
  prompt: LocalizedText;
  options: ChoiceOption[];
  /** Must be made before the mission can be completed. */
  requiredForCompletion: boolean;
  /** A puzzle that must be solved before this choice is offered. */
  requiresPuzzle?: string;
  meta: ContentMeta;
}

/** An optional side task with a numeric goal (e.g. deliver water N times). */
export interface OptionalTask {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  goal: number;
  xp: number;
  badge?: string;
  meta: ContentMeta;
}

export interface Mission {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  areas: Area[];
  discoveries: Discovery[];
  puzzles: Puzzle[];
  choices: Choice[];
  tasks: OptionalTask[];
  /** Puzzles that must be solved to complete the mission. */
  completionRequiresPuzzles: string[];
  completionXp: number;
  completionBadge: string;
}

export interface Chapter {
  id: string;
  order: number;
  title: LocalizedText;
  setting: LocalizedText;
  /** `expanded` = the full mission format (Mecca); `legacy` = the earlier prototype format. */
  format: 'expanded' | 'legacy';
  mission: Mission;
}

export interface Catalog {
  version: number;
  chapters: Chapter[];
  skills: Skill[];
  badges: Badge[];
}
