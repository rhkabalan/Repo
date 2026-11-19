/** Shapes of the localized catalog served by GET /v1/journey/content. */
export interface Source { id: string; citation: string; url?: string }
export interface Meta { certainty: 'sourced' | 'uncertain' | 'fictional'; review: string }
export interface Discovery { id: string; areaId: string; title: string; body: string; sources: Source[]; xp: number; meta: Meta }
export interface PuzzleOption { id: string; label: string }
export interface Puzzle { id: string; areaId: string; prompt: string; options: PuzzleOption[]; requiresDiscoveries: string[]; xp: number }
export interface ChoiceOption { id: string; label: string; journal?: string }
export interface Choice { id: string; prompt: string; options: ChoiceOption[]; requiredForCompletion: boolean; requiresPuzzle?: string }
export interface Task { id: string; title: string; description: string; goal: number; xp: number }
export interface Mission { id: string; title: string; summary: string; areas: { id: string; name: string }[]; discoveries: Discovery[]; puzzles: Puzzle[]; choices: Choice[]; tasks: Task[]; completionXp: number }
export interface Chapter { id: string; order: number; title: string; setting: string; format: 'expanded' | 'legacy'; mission: Mission }
export interface Catalog { lang: 'ar' | 'en'; version: number; chapters: Chapter[]; skills: { id: string; name: string }[]; badges: { id: string; name: string; description: string }[] }
