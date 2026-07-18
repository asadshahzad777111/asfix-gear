import { OAuth2Client } from 'google-auth-library';

const clientId = () => String(process.env.GOOGLE_CLIENT_ID || '').trim();

export function isGoogleAuthConfigured() {
  return Boolean(clientId());
}

/**
 * Verify a Google Identity Services ID token (JWT).
 * Checks signature, expiry, audience, and issuer via google-auth-library.
 */
export async function verifyGoogleIdToken(idToken) {
  const aud = clientId();
  if (!aud) {
    const err = new Error('Google Sign-In is not configured');
    err.code = 'GOOGLE_NOT_CONFIGURED';
    throw err;
  }

  const client = new OAuth2Client(aud);
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: String(idToken || '').trim(),
      audience: aud,
    });
  } catch {
    const err = new Error('Invalid or expired Google sign-in');
    err.code = 'GOOGLE_TOKEN_INVALID';
    throw err;
  }

  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    const err = new Error('Invalid Google account payload');
    err.code = 'GOOGLE_TOKEN_INVALID';
    throw err;
  }
  if (payload.email_verified !== true) {
    const err = new Error('Google email is not verified');
    err.code = 'GOOGLE_EMAIL_UNVERIFIED';
    throw err;
  }

  return {
    googleId: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || payload.given_name || '').trim(),
  };
}
