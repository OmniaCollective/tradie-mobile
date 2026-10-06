import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifyIdentityToken } from '../_lib/apple.js';
import { requireEnv, requirePost, sendError } from '../_lib/http.js';
import { createSession } from '../_lib/session.js';

/**
 * POST { identityToken } → { data: { token, userId } }
 * Swaps a short-lived Apple identity token for a Tradie session token.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;
  const env = requireEnv(res, 'APPLE_BUNDLE_ID', 'SESSION_SECRET');
  if (!env) return;

  const identityToken = req.body?.identityToken;
  if (typeof identityToken !== 'string' || !identityToken) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'identityToken is required');
  }

  let userId: string;
  try {
    ({ userId } = await verifyIdentityToken(identityToken, env.APPLE_BUNDLE_ID));
  } catch (err) {
    console.error('Apple identity token rejected:', err);
    return sendError(res, 401, 'UNAUTHORIZED', 'Apple sign-in could not be verified');
  }

  const token = await createSession(userId);
  return res.status(200).json({ data: { token, userId } });
}
