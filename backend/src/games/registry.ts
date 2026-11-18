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

export const defaultGames = (): AnyGameDefinition[] => [createOrbRush()];
