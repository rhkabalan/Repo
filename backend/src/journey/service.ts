import type { Db, Queryable } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { AppError } from '../lib/errors.js';
import { getUsers } from '../users/service.js';
import { JourneyView } from './view.js';
import type { Catalog, Lang } from './content/types.js';
import { applyEvent, initialState, upgradeState, type Award, type JourneyEvent, type JourneyState } from './engine.js';

export class JourneyService {
  private readonly presenter: JourneyView;

  constructor(
    private readonly db: Db,
    private readonly catalog: Catalog,
  ) {
    this.presenter = new JourneyView(catalog);
  }

  private async load(db: Queryable, userId: string, lock: boolean): Promise<{ state: JourneyState; version: number }> {
    const { rows } = await db.query<{ state: JourneyState; version: number }>(
      `SELECT state, version FROM journey_progress WHERE user_id = $1 ${lock ? 'FOR UPDATE' : ''}`,
      [userId],
    );
    if (rows[0]) return { state: upgradeState(this.catalog, rows[0].state), version: rows[0].version };
    const state = initialState(this.catalog);
    // Create the row so a concurrent first event can lock it.
    await db.query(
      `INSERT INTO journey_progress (user_id, state) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING`,
      [userId, JSON.stringify(state)],
    );
    if (lock) return this.load(db, userId, true);
    return { state, version: 1 };
  }

  async get(userId: string, lang: Lang) {
    const { state, version } = await this.load(this.db, userId, false);
    return this.view(state, version, lang);
  }

  /** Apply a player action atomically. XP also feeds the account-wide level. */
  async apply(userId: string, event: JourneyEvent, lang: Lang) {
    const { result, awards, state, version } = await this.applyRaw(userId, event);
    return { result, awards: this.localizeAwards(awards, lang), journey: this.view(state, version, lang) };
  }

  /**
   * Make sure every party member can play `chapterId` together: it must be unlocked for all
   * of them, and anyone who already completed it starts a fresh replay run.
   */
  async prepareParty(userIds: string[], chapterId: string): Promise<void> {
    const locked: string[] = [];
    for (const userId of userIds) {
      const { state } = await this.load(this.db, userId, false);
      const status = state.chapters[chapterId]?.status;
      if (!status || status === 'locked') locked.push(userId);
    }
    if (locked.length) {
      const names = await getUsers(this.db, locked);
      throw new AppError(
        409,
        'chapter_locked',
        `Not unlocked yet for: ${locked.map((id) => names.get(id)?.displayName ?? id).join(', ')}`,
        { userIds: locked },
      );
    }
    for (const userId of userIds) {
      const { state } = await this.load(this.db, userId, false);
      if (state.chapters[chapterId]!.status === 'completed') {
        await this.applyRaw(userId, { type: 'chapter.replay', chapterId });
      }
    }
  }

  async applyRaw(userId: string, event: JourneyEvent) {
    return withTransaction(this.db, async (client) => {
      const { state: before, version } = await this.load(client, userId, true);
      const { state, awards, result } = applyEvent(this.catalog, before, event);
      const xp = awards.reduce((s, a) => (a.type === 'xp' ? s + a.amount : s), 0);
      await client.query(
        `UPDATE journey_progress SET state = $2::jsonb, version = version + 1, updated_at = now() WHERE user_id = $1`,
        [userId, JSON.stringify(state)],
      );
      await client.query(
        `INSERT INTO journey_events (user_id, chapter_id, type, payload, xp_awarded) VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [userId, event.chapterId, event.type, JSON.stringify({ event, result }), xp],
      );
      if (xp > 0) {
        await client.query(`UPDATE player_stats SET xp = xp + $2, updated_at = now() WHERE user_id = $1`, [userId, xp]);
      }
      return { result, awards, state, version: version + 1 };
    });
  }

  private localizeAwards(awards: Award[], lang: Lang) {
    return this.presenter.localizeAwards(awards, lang);
  }

  view(state: JourneyState, version: number, lang: Lang) {
    return this.presenter.view(state, version, lang);
  }
}
