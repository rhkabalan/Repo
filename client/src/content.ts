/** Shapes of the localized catalog served by GET /v1/journey/content. */
export interface Source { id: string; citation: string; url?: string }
export interface Meta { certainty: 'sourced' | 'uncertain' | 'fictional'; review: string }
export interface Discovery { id: string; areaId: string; title: string; body: string; sources: Source[]; xp: number; meta: Meta }
export interface PuzzleOption { id: string; label: string }
export interface Puzzle { id: string; kind: 'sequence' | 'mechanism'; areaId: string; prompt: string; options?: PuzzleOption[]; requiresDiscoveries: string[]; xp: number }
export interface ChoiceOption { id: string; label: string; journal?: string }
export interface Choice { id: string; prompt: string; options: ChoiceOption[]; requiredForCompletion: boolean; requiresPuzzle?: string }
export interface Task { id: string; title: string; description: string; goal: number; xp: number; consumes?: Record<string, number>; rewards?: Record<string, number> }
export interface Collectible { id: string; areaId: string; item: string; amount: number; title?: string; text?: string; xp: number; meta: Meta }
export type Method = 'fight' | 'sneak' | 'route';
export interface Encounter { id: string; areaId: string; title: string; description: string; methods: Method[]; requires?: Partial<Record<Method, Record<string, number>>>; requiredForCompletion: boolean }
export interface Item { id: string; name: string; kind: 'water' | 'provisions' | 'material' | 'key'; baseCapacity: number }
export interface Mission { id: string; title: string; summary: string; areas: { id: string; name: string }[]; discoveries: Discovery[]; puzzles: Puzzle[]; choices: Choice[]; tasks: Task[]; collectibles: Collectible[]; encounters: Encounter[]; completionXp: number }
export interface Chapter { id: string; order: number; title: string; setting: string; format: 'expanded' | 'legacy'; mission: Mission }
export interface Catalog { lang: 'ar' | 'en'; version: number; chapters: Chapter[]; skills: { id: string; name: string }[]; badges: { id: string; name: string; description: string; category: 'adventure' | 'history' }[]; items: Item[] }
