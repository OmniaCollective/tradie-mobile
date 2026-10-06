import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appleConfigFromEnv, revokeAppleSignIn } from '../_lib/apple.js';
import { requireEnv, requirePost, requireUser, sendError } from '../_lib/http.js';
import { deleteSubscriber } from '../_lib/revenuecat.js';

/**
 * POST { authorizationCode } → { data: { deleted: true } }
 *
 * Apple requires in-app account deletion to revoke the Sign in with Apple
 * grant. The app asks the user to sign in with Apple once more to get a fresh
 * authorization code (valid five minutes, single use) and sends it here.
 * Job data lives only on the phone; the app clears it after this succeeds.
 * An active App Store subscription is not cancelled by this — the app tells
 * the user to cancel it in Settings, as Apple's guidelines expect.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;
  const userId = await requireUser(req, res);
  if (!userId) return;
  const env = requireEnv(
    res,
    'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_BUNDLE_ID', 'APPLE_PRIVATE_KEY', 'REVENUECAT_SECRET_KEY'
  );
  if (!env) return;

  const authorizationCode = req.body?.authorizationCode;
  if (typeof authorizationCode !== 'string' || !authorizationCode) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'authorizationCode is required');
  }

  try {
    await revokeAppleSignIn(appleConfigFromEnv(env), authorizationCode, userId);
  } catch (err) {
    console.error('Apple revoke failed:', err);
    return sendError(res, 502, 'UPSTREAM_ERROR', 'Could not remove Sign in with Apple, please try again');
  }

  try {
    await deleteSubscriber(env.REVENUECAT_SECRET_KEY, userId);
  } catch (err) {
    console.error('RevenueCat delete failed:', err);
    return sendError(res, 502, 'UPSTREAM_ERROR', 'Could not finish deleting your account, please try again');
  }

  return res.status(200).json({ data: { deleted: true } });
}
