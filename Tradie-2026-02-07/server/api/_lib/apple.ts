import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from 'jose';

const APPLE_ISSUER = 'https://appleid.apple.com';
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

/**
 * Verifies an identity token from Sign in with Apple and returns the Apple user id.
 * Signature, issuer, audience (our bundle id) and expiry are all checked by jose.
 */
export async function verifyIdentityToken(
  identityToken: string,
  bundleId: string
): Promise<{ userId: string; email?: string }> {
  const { payload } = await jwtVerify(identityToken, appleKeys, {
    issuer: APPLE_ISSUER,
    audience: bundleId,
  });
  if (!payload.sub) throw new Error('Identity token has no subject');
  return { userId: payload.sub, email: typeof payload.email === 'string' ? payload.email : undefined };
}

interface AppleConfig {
  teamId: string;
  keyId: string;
  bundleId: string;
  privateKey: string;
}

/** The client secret Apple's token endpoints want: an ES256 JWT signed with our .p8 key. */
async function clientSecret(config: AppleConfig): Promise<string> {
  // Vercel env values often arrive with literal "\n" instead of newlines.
  const pem = config.privateKey.replace(/\\n/g, '\n');
  const key = await importPKCS8(pem, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setSubject(config.bundleId)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

/**
 * Account deletion, as Apple requires for apps with Sign in with Apple:
 * exchange a fresh authorization code for a refresh token, then revoke it.
 * Checks the code belongs to `expectedUserId` so one user can't revoke another.
 */
export async function revokeAppleSignIn(
  config: AppleConfig,
  authorizationCode: string,
  expectedUserId: string
): Promise<void> {
  const secret = await clientSecret(config);

  const tokenRes = await fetch(`${APPLE_ISSUER}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.bundleId,
      client_secret: secret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Apple token exchange failed (${tokenRes.status}): ${await tokenRes.text()}`);
  }
  const tokens = (await tokenRes.json()) as { refresh_token?: string; id_token?: string };
  if (!tokens.refresh_token || !tokens.id_token) {
    throw new Error('Apple token exchange returned no refresh token');
  }

  const { userId } = await verifyIdentityToken(tokens.id_token, config.bundleId);
  if (userId !== expectedUserId) {
    throw new Error('Authorization code belongs to a different Apple user');
  }

  const revokeRes = await fetch(`${APPLE_ISSUER}/auth/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.bundleId,
      client_secret: secret,
      token: tokens.refresh_token,
      token_type_hint: 'refresh_token',
    }),
  });
  if (!revokeRes.ok) {
    throw new Error(`Apple revoke failed (${revokeRes.status}): ${await revokeRes.text()}`);
  }
}

export function appleConfigFromEnv(env: Record<string, string>): AppleConfig {
  return {
    teamId: env.APPLE_TEAM_ID,
    keyId: env.APPLE_KEY_ID,
    bundleId: env.APPLE_BUNDLE_ID,
    privateKey: env.APPLE_PRIVATE_KEY,
  };
}
