import { notFound } from '../lib/errors.js';
import { createOrbRush } from './orb-rush/index.js';
import type { AnyGameDefinition } from './types.js';

export class GameRegistry {
  private readonly games = new Map<string, AnyGameDefinition>();

  constructor(games: AnyGameDefinition[]) {
    for (const g of games) this.games.set(g.id, g);
  }

  get(id: string): AnyGameDefinition {
    const game = this.games.get(id);
    if (!game) throw notFound(`Unknown game "${id}"`);
    return game;
  }

  has(id: string): boolean {
    return this.games.has(id);
  }

  list(): AnyGameDefinition[] {
    return [...this.games.values()];
  }
}

/**
 * Games available for real-time rooms and arcade-style solo runs. ATHAR's story journey
 * runs through the journey module instead. Orb Rush remains as the reference
 * implementation (and test fixture) for when a multiplayer mode is designed.
 */
export const defaultGames = (): AnyGameDefinition[] => [];

export { createOrbRush };
