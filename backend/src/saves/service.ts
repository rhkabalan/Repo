import type { Db } from '../db/pool.js';
import { conflict, notFound } from '../lib/errors.js';

export interface SaveSlot {
  slot: string;
  version: number;
  updatedAt: string;
  data?: unknown;
}

interface Row {
  slot: string;
  version: number;
  updated_at: Date;
  data?: unknown;
}

const toSlot = (r: Row): SaveSlot => ({
  slot: r.slot,
  version: r.version,
  updatedAt: r.updated_at.toISOString(),
  ...(r.data !== undefined ? { data: r.data } : {}),
});

export const MAX_SLOTS_PER_USER = 20;

/** Cloud saves with optimistic concurrency so two devices can't silently overwrite each other. */
export class SaveService {
  constructor(private readonly db: Db) {}

  async list(userId: string): Promise<SaveSlot[]> {
    const { rows } = await this.db.query<Row>(
      'SELECT slot, version, updated_at FROM save_slots WHERE user_id = $1 ORDER BY slot',
      [userId],
    );
    return rows.map(toSlot);
  }

  async get(userId: string, slot: string): Promise<SaveSlot> {
    const { rows } = await this.db.query<Row>(
      'SELECT slot, version, updated_at, data FROM save_slots WHERE user_id = $1 AND slot = $2',
      [userId, slot],
    );
    if (!rows[0]) throw notFound('Save slot not found');
    return toSlot(rows[0]);
  }

  /**
   * Write a slot. If `expectedVersion` is given the write only succeeds when it matches the
   * stored version (use 0 to mean "must not exist yet"); otherwise it is last-write-wins.
   */
  async put(userId: string, slot: string, data: unknown, expectedVersion?: number): Promise<SaveSlot> {
    const json = JSON.stringify(data);
    let result;
    if (expectedVersion === undefined) {
      result = await this.db.query<Row>(
        `INSERT INTO save_slots (user_id, slot, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (user_id, slot) DO UPDATE
           SET data = EXCLUDED.data, version = save_slots.version + 1, updated_at = now()
         RETURNING slot, version, updated_at`,
        [userId, slot, json],
      );
    } else if (expectedVersion === 0) {
      result = await this.db.query<Row>(
        `INSERT INTO save_slots (user_id, slot, data) VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (user_id, slot) DO NOTHING
         RETURNING slot, version, updated_at`,
        [userId, slot, json],
      );
    } else {
      result = await this.db.query<Row>(
        `UPDATE save_slots SET data = $3::jsonb, version = version + 1, updated_at = now()
          WHERE user_id = $1 AND slot = $2 AND version = $4
         RETURNING slot, version, updated_at`,
        [userId, slot, json, expectedVersion],
      );
    }
    if (result.rows[0]) {
      await this.enforceSlotLimit(userId, slot);
      return toSlot(result.rows[0]);
    }
    const current = await this.db.query<{ version: number }>(
      'SELECT version FROM save_slots WHERE user_id = $1 AND slot = $2',
      [userId, slot],
    );
    throw conflict('version_conflict', 'Save was modified on another device', {
      currentVersion: current.rows[0]?.version ?? 0,
    });
  }

  private async enforceSlotLimit(userId: string, slot: string) {
    const { rows } = await this.db.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM save_slots WHERE user_id = $1',
      [userId],
    );
    if ((rows[0]?.n ?? 0) > MAX_SLOTS_PER_USER) {
      await this.db.query('DELETE FROM save_slots WHERE user_id = $1 AND slot = $2', [userId, slot]);
      throw conflict('slot_limit', `A player can have at most ${MAX_SLOTS_PER_USER} save slots`);
    }
  }

  async delete(userId: string, slot: string): Promise<void> {
    const res = await this.db.query('DELETE FROM save_slots WHERE user_id = $1 AND slot = $2', [userId, slot]);
    if (res.rowCount === 0) throw notFound('Save slot not found');
  }
}
