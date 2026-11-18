import { OAuth2Client } from 'google-auth-library';
import { unauthorized } from '../lib/errors.js';

export interface GoogleProfile {
  subject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  picture?: string;
}

/** Verifies a Google ID token and returns the player's Google profile. */
export type GoogleVerifier = (idToken: string) => Promise<GoogleProfile>;

/**
 * Verifies ID tokens issued to any of our OAuth clients (Web, Android, iOS...).
 * Every platform's Google Sign-In SDK can produce such an ID token.
 */
export function createGoogleVerifier(clientIds: string[]): GoogleVerifier {
  const client = new OAuth2Client();
  return async (idToken) => {
    if (clientIds.length === 0) throw unauthorized('Google sign-in is not configured on this server');
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientIds });
      const p = ticket.getPayload();
      if (!p?.sub) throw new Error('no subject');
      return {
        subject: p.sub,
        email: p.email,
        emailVerified: p.email_verified === true,
        name: p.name,
        picture: p.picture,
      };
    } catch {
      throw unauthorized('Invalid Google ID token');
    }
  };
}
