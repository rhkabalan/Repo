/**
 * Offline single-player backend that runs in the browser. It reuses the server's own
 * journey rules, content and presentation code, so solo play behaves exactly like online
 * play. Progress is kept in this browser's storage.
 */
import { catalog } from '../../../backend/src/journey/content/catalog';
import { applyEvent, initialState, journeyEventSchema, upgradeState, type JourneyState } from '../../../backend/src/journey/engine';
import { localize } from '../../../backend/src/journey/localize';
import { JourneyView } from '../../../backend/src/journey/view';
import { levelForXp } from '../../../backend/src/lib/levels';
import type { ApiError, Lang } from './api';

interface Profile {
  id: string;
  displayName: string;
  avatarUrl: null;
  isGuest: true;
  characterId: string | null;
  createdAt: string;
}

const KEYS = { profile: 'athar.offline.profile', journey: 'athar.offline.journey' };
const presenter = new JourneyView(catalog);
const memory = new Map<string, string>();

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key) ?? memory.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    const raw = memory.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
}

function write(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  memory.set(key, raw);
  try {
    localStorage.setItem(key, raw);
  } catch {
    /* private mode: keep it for this visit only */
  }
}

function profile(): Profile {
  let p = read<Profile>(KEYS.profile);
  if (!p) {
    p = {
      id: crypto.randomUUID?.() ?? String(Date.now()),
      displayName: `Player${Math.floor(1000 + Math.random() * 9000)}`,
      avatarUrl: null,
      isGuest: true,
      characterId: null,
      createdAt: new Date().toISOString(),
    };
    write(KEYS.profile, p);
  }
  return p;
}

function journey(): { state: JourneyState; version: number } {
  const saved = read<{ state: JourneyState; version: number }>(KEYS.journey);
  return saved ? { state: upgradeState(catalog, saved.state), version: saved.version } : { state: initialState(catalog), version: 1 };
}

const fail = (status: number, code: string, message: string, details?: unknown): never => {
  throw { status, code, message, details } satisfies ApiError;
};

export async function offlineRequest(method: string, path: string, body: unknown, lang: Lang): Promise<unknown> {
  const route = `${method} ${path.split('?')[0]}`;
  switch (route) {
    case 'POST /v1/auth/guest':
      profile();
      return { tokens: { accessToken: 'offline', refreshToken: 'offline' } };
    case 'GET /v1/me': {
      const xp = journey().state.xp;
      return { user: profile(), stats: { xp, level: levelForXp(xp), gamesPlayed: 0, wins: 0, losses: 0 } };
    }
    case 'PATCH /v1/me': {
      const patch = body as { displayName?: string; characterId?: string };
      const p = { ...profile(), ...patch } as Profile;
      write(KEYS.profile, p);
      return { user: p };
    }
    case 'GET /v1/journey/content':
      return { lang, ...(localize(catalog, lang) as object) };
    case 'GET /v1/journey': {
      const { state, version } = journey();
      return presenter.view(state, version, lang);
    }
    case 'POST /v1/journey/events': {
      const parsed = journeyEventSchema.safeParse(body);
      if (!parsed.success) return fail(400, 'bad_request', 'Invalid request');
      const { state: before, version } = journey();
      try {
        const { state, awards, result } = applyEvent(catalog, before, parsed.data);
        write(KEYS.journey, { state, version: version + 1 });
        return { result, awards: presenter.localizeAwards(awards, lang), journey: presenter.view(state, version + 1, lang) };
      } catch (err) {
        const e = err as { statusCode?: number; code?: string; message?: string; details?: unknown };
        return fail(e.statusCode ?? 400, e.code ?? 'error', e.message ?? 'Error', e.details);
      }
    }
    case 'POST /v1/auth/logout':
      return undefined;
    default:
      return fail(404, 'offline', 'Not available in the offline build');
  }
}
