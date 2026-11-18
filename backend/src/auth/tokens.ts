import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { Db, Queryable } from '../db/pool.js';
import { withTransaction } from '../db/pool.js';
import { unauthorized } from '../lib/errors.js';

export interface AccessClaims {
  userId: string;
  isGuest: boolean;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

const ISSUER = 'game-backend';
const AUDIENCE = 'game-client';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export class TokenService {
  private readonly key: Uint8Array;

  constructor(
    private readonly db: Db,
    secret: string,
    private readonly accessTtlSeconds: number,
    private readonly refreshTtlDays: number,
  ) {
    this.key = new TextEncoder().encode(secret);
  }

  async signAccess(claims: AccessClaims): Promise<string> {
    return new SignJWT({ guest: claims.isGuest })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(`${this.accessTtlSeconds}s`)
      .sign(this.key);
  }

  async verifyAccess(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        issuer: ISSUER,
        audience: AUDIENCE,
        algorithms: ['HS256'],
      });
      if (!payload.sub) throw new Error('missing sub');
      return { userId: payload.sub, isGuest: payload.guest === true };
    } catch {
      throw unauthorized('Invalid or expired access token');
    }
  }

  /** Start a new sign-in session (new refresh-token family). */
  async issue(db: Queryable, claims: AccessClaims): Promise<TokenPair> {
    return this.issueInFamily(db, claims, randomUUID());
  }

  private async issueInFamily(db: Queryable, claims: AccessClaims, familyId: string): Promise<TokenPair> {
    const refreshToken = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + this.refreshTtlDays * 86_400_000);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
      [claims.userId, familyId, sha256(refreshToken), expiresAt],
    );
    return {
      accessToken: await this.signAccess(claims),
      accessTokenExpiresIn: this.accessTtlSeconds,
      refreshToken,
      refreshTokenExpiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Exchange a refresh token for a new pair. The presented token is revoked (rotation).
   * Presenting an already-rotated token is treated as theft: the whole family is revoked.
   */
  async rotate(refreshToken: string): Promise<{ tokens: TokenPair; userId: string }> {
    const outcome = await withTransaction(this.db, async (client) => {
      const { rows } = await client.query<{
        id: string;
        user_id: string;
        family_id: string;
        expires_at: Date;
        revoked_at: Date | null;
        is_guest: boolean;
      }>(
        `SELECT rt.id, rt.user_id, rt.family_id, rt.expires_at, rt.revoked_at, u.is_guest
           FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
          WHERE rt.token_hash = $1
          FOR UPDATE OF rt`,
        [sha256(refreshToken)],
      );
      const row = rows[0];
      if (!row) throw unauthorized('Invalid refresh token');
      if (row.revoked_at) {
        await client.query(
          `UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL`,
          [row.family_id],
        );
        // Return (not throw) so the revocation commits.
        return 'reuse_detected' as const;
      }
      if (row.expires_at.getTime() <= Date.now()) throw unauthorized('Refresh token expired');

      await client.query(`UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1`, [row.id]);
      await client.query(`UPDATE users SET last_seen_at = now() WHERE id = $1`, [row.user_id]);
      const tokens = await this.issueInFamily(
        client,
        { userId: row.user_id, isGuest: row.is_guest },
        row.family_id,
      );
      return { tokens, userId: row.user_id };
    });
    if (outcome === 'reuse_detected') throw unauthorized('Refresh token reuse detected; please sign in again');
    return outcome;
  }

  /** Revoke the sign-in session that a refresh token belongs to. Idempotent. */
  async revokeFamily(refreshToken: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = now()
        WHERE revoked_at IS NULL
          AND family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1)`,
      [sha256(refreshToken)],
    );
  }
}
