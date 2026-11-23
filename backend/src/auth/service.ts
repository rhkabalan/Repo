import type { Db } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { conflict } from '../lib/errors.js';
import { createUser, getUser, randomGuestName, type User } from '../users/service.js';
import type { GoogleVerifier } from './google.js';
import type { TokenPair, TokenService } from './tokens.js';

export interface Session {
  user: User;
  tokens: TokenPair;
  isNewUser: boolean;
}

export class AuthService {
  constructor(
    private readonly db: Db,
    private readonly tokens: TokenService,
    private readonly verifyGoogle: GoogleVerifier,
  ) {}

  /**
   * Create a brand-new guest account. The returned refresh token is the guest's only
   * credential: clients must store it securely (Keychain / Keystore / secure storage).
   */
  async signInAsGuest(displayName?: string): Promise<Session> {
    return withTransaction(this.db, async (client) => {
      const user = await createUser(client, { displayName: displayName ?? randomGuestName(), isGuest: true });
      const tokens = await this.tokens.issue(client, { userId: user.id, isGuest: true });
      return { user, tokens, isNewUser: true };
    });
  }

  /** Sign in with Google, creating the account on first sign-in. */
  async signInWithGoogle(idToken: string): Promise<Session> {
    const profile = await this.verifyGoogle(idToken);
    return withTransaction(this.db, async (client) => {
      const existing = await client.query<{ user_id: string }>(
        `SELECT user_id FROM auth_identities WHERE provider = 'google' AND provider_subject = $1`,
        [profile.subject],
      );
      let user: User;
      let isNewUser = false;
      if (existing.rows[0]) {
        user = await getUser(client, existing.rows[0].user_id);
        await client.query('UPDATE users SET last_seen_at = now() WHERE id = $1', [user.id]);
      } else {
        user = await createUser(client, {
          displayName: profile.name?.slice(0, 32) || randomGuestName(),
          avatarUrl: profile.picture ?? null,
          isGuest: false,
        });
        await client.query(
          `INSERT INTO auth_identities (user_id, provider, provider_subject, email) VALUES ($1, 'google', $2, $3)`,
          [user.id, profile.subject, profile.email ?? null],
        );
        isNewUser = true;
      }
      const tokens = await this.tokens.issue(client, { userId: user.id, isGuest: false });
      return { user, tokens, isNewUser };
    });
  }

  /**
   * Upgrade a guest to a Google account, keeping all progress. Fails with 409 if the
   * Google account already belongs to another player.
   */
  async linkGoogle(userId: string, idToken: string): Promise<Session> {
    const profile = await this.verifyGoogle(idToken);
    return withTransaction(this.db, async (client) => {
      const owner = await client.query<{ user_id: string }>(
        `SELECT user_id FROM auth_identities WHERE provider = 'google' AND provider_subject = $1`,
        [profile.subject],
      );
      const ownerId = owner.rows[0]?.user_id;
      if (ownerId && ownerId !== userId) {
        throw conflict('identity_in_use', 'This Google account is already linked to another player');
      }
      if (!ownerId) {
        await client.query(
          `INSERT INTO auth_identities (user_id, provider, provider_subject, email) VALUES ($1, 'google', $2, $3)`,
          [userId, profile.subject, profile.email ?? null],
        );
      }
      await client.query(
        `UPDATE users SET is_guest = false, avatar_url = COALESCE(avatar_url, $2), updated_at = now() WHERE id = $1`,
        [userId, profile.picture ?? null],
      );
      const user = await getUser(client, userId);
      // Issue fresh tokens so the access token no longer carries the guest flag.
      const tokens = await this.tokens.issue(client, { userId, isGuest: false });
      return { user, tokens, isNewUser: false };
    });
  }
}
