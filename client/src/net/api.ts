/** REST client for the ATHAR backend, with automatic token refresh. */

export type Lang = 'ar' | 'en';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

const STORE_KEY = 'athar.session';
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

function loadTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

function saveTokens(t: Tokens | null) {
  try {
    if (t) localStorage.setItem(STORE_KEY, JSON.stringify(t));
    else localStorage.removeItem(STORE_KEY);
  } catch {
    /* private mode: session lasts for this tab only */
  }
}

export class Api {
  private tokens: Tokens | null = loadTokens();
  private refreshing: Promise<boolean> | null = null;
  lang: Lang = 'ar';

  get signedIn() {
    return this.tokens !== null;
  }

  get accessToken() {
    return this.tokens?.accessToken ?? '';
  }

  get realtimeUrl() {
    const base = API_BASE || location.origin;
    return base.replace(/^http/, 'ws') + '/v1/realtime';
  }

  private setSession(t: { accessToken: string; refreshToken: string }) {
    this.tokens = { accessToken: t.accessToken, refreshToken: t.refreshToken };
    saveTokens(this.tokens);
  }

  async signInAsGuest(): Promise<void> {
    const res = await this.request<{ tokens: Tokens }>('POST', '/v1/auth/guest', {}, false);
    this.setSession(res.tokens);
  }

  async signInWithGoogle(idToken: string): Promise<void> {
    const res = await this.request<{ tokens: Tokens }>('POST', '/v1/auth/google', { idToken }, false);
    this.setSession(res.tokens);
  }

  signOut() {
    const t = this.tokens;
    this.tokens = null;
    saveTokens(null);
    if (t) void fetch(`${API_BASE}/v1/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: t.refreshToken }) });
  }

  /** Refresh once even if many requests 401 at the same time. */
  async refresh(): Promise<boolean> {
    if (!this.tokens) return false;
    this.refreshing ??= (async () => {
      try {
        const res = await fetch(`${API_BASE}/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ refreshToken: this.tokens!.refreshToken }),
        });
        if (!res.ok) {
          this.tokens = null;
          saveTokens(null);
          return false;
        }
        this.setSession(((await res.json()) as { tokens: Tokens }).tokens);
        return true;
      } finally {
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  async request<T>(method: string, path: string, body?: unknown, auth = true): Promise<T> {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${API_BASE}${path}${sep}lang=${this.lang}`;
    const doFetch = () =>
      fetch(url, {
        method,
        headers: {
          ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
          ...(auth && this.tokens ? { authorization: `Bearer ${this.tokens.accessToken}` } : {}),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    let res = await doFetch();
    if (res.status === 401 && auth && (await this.refresh())) res = await doFetch();
    if (res.status === 204) return undefined as T;
    const json = (await res.json().catch(() => ({}))) as { error?: Omit<ApiError, 'status'> } & T;
    if (!res.ok) {
      throw { status: res.status, code: json.error?.code ?? 'error', message: json.error?.message ?? res.statusText, details: json.error?.details } satisfies ApiError;
    }
    return json;
  }

  get = <T>(path: string) => this.request<T>('GET', path);
  post = <T>(path: string, body: unknown) => this.request<T>('POST', path, body);
}

export const api = new Api();
