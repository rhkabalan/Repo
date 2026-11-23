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
  /** Adventure badges reward play; history badges reward understanding the sourced story. */
  category: 'adventure' | 'history';
}

/** Something the traveler can carry. Keys are single quest items. */
export interface Item {
  id: string;
  name: LocalizedText;
  kind: 'water' | 'provisions' | 'material' | 'key';
  /** How many can be carried before upgrades. */
  baseCapacity: number;
  /** Extra capacity per level of the `capacity` upgrade. */
  capacityPerLevel: number;
}

export type UpgradeId = 'stamina' | 'defense' | 'exploration' | 'capacity';

export interface Upgrade {
  id: UpgradeId;
  name: LocalizedText;
  description: LocalizedText;
  /** costs[level] = items needed to go from `level` to `level + 1`. */
  costs: Record<string, number>[];
}

/** A pickup placed in the world: supplies, materials, quest items or journal fragments. */
export interface Collectible {
  id: string;
  areaId: string;
  /** Item granted, or 'fragment' for a journal fragment (text, not inventory). */
  item: string | 'fragment';
  amount: number;
  /** Fragments only: what the traveler writes down. */
  title?: LocalizedText;
  text?: LocalizedText;
  xp: number;
  meta: ContentMeta;
}

export type EncounterMethod = 'fight' | 'sneak' | 'route';

/** A fictional obstacle the traveler resolves by fighting, sneaking past or going around. */
export interface Encounter {
  id: string;
  areaId: string;
  title: LocalizedText;
  description: LocalizedText;
  methods: EncounterMethod[];
  rewards: Partial<Record<EncounterMethod, { xp: number; items?: Record<string, number> }>>;
  /** Items a method needs, e.g. the route needs a gate key. */
  requires?: Partial<Record<EncounterMethod, Record<string, number>>>;
  requiredForCompletion: boolean;
  meta: ContentMeta;
}

export interface Area {
  id: string;
  name: LocalizedText;
  /** A puzzle that must be solved before entering, if any. */
  unlockedBy?: string;
  /** An encounter that must be resolved before entering, if any. */
  unlockedByEncounter?: string;
  meta: ContentMeta;
}

export interface Discovery {
  id: string;
  areaId: string;
  title: LocalizedText;
  body: LocalizedText;
  sources: SourceRef[];
  xp: number;
  /** History badge awarded the first time this account is discovered. */
  badge?: string;
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

/**
 * A physical puzzle solved in the 3D world (push crates, turn a mechanism). The client
 * reports the solution; the server records it and unlocks what depends on it.
 */
export interface MechanismPuzzle {
  id: string;
  kind: 'mechanism';
  areaId: string;
  prompt: LocalizedText;
  requiresDiscoveries: string[];
  xp: number;
  meta: ContentMeta;
}

export type Puzzle = SequencePuzzle | MechanismPuzzle;

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
  /** Items handed over per unit of progress (e.g. one water per delivery). */
  consumes?: Record<string, number>;
  /** Items received when the task is completed. */
  rewards?: Record<string, number>;
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
  collectibles: Collectible[];
  encounters: Encounter[];
  /** Puzzles that must be solved to complete the mission. */
  completionRequiresPuzzles: string[];
  /** Accounts that must be discovered to complete the mission. */
  completionRequiresDiscoveries: string[];
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
  items: Item[];
  upgrades: Upgrade[];
}
