import { SignJWT, jwtVerify } from 'jose';

/**
 * App sessions are self-contained signed tokens, so the server needs no database.
 * The subject is the user's Apple user id. Apple identity tokens only live
 * 10 minutes, so the app swaps one for this longer-lived token at sign-in.
 */

const ISSUER = 'tradie-api';
const SESSION_DAYS = 365;

function secret(): Uint8Array | null {
  const value = process.env.SESSION_SECRET;
  return value ? new TextEncoder().encode(value) : null;
}

export async function createSession(userId: string): Promise<string> {
  const key = secret();
  if (!key) throw new Error('SESSION_SECRET is not set');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(key);
}

/** Returns the user id, or null for a missing, expired or forged token. */
export async function verifySession(token: string): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify(token, key, { issuer: ISSUER, algorithms: ['HS256'] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}
