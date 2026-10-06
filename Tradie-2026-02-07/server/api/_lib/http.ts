import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySession } from './session.js';

/** Every error the app can receive. The app switches on `code`, never on `message`. */
export type ErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'VOICE_LIMIT_REACHED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'CONFIG_ERROR';

export function sendError(res: VercelResponse, status: number, code: ErrorCode, message: string) {
  return res.status(status).json({ error: { code, message } });
}

export function requirePost(req: VercelRequest, res: VercelResponse): boolean {
  if (req.method === 'POST') return true;
  sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method not allowed');
  return false;
}

/** Reads a required env var; sends CONFIG_ERROR and returns null if it is missing. */
export function requireEnv(res: VercelResponse, ...names: string[]): Record<string, string> | null {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = process.env[name];
    if (!value) {
      console.error(`${name} is not set`);
      sendError(res, 500, 'CONFIG_ERROR', 'Server configuration error');
      return null;
    }
    values[name] = value;
  }
  return values;
}

/**
 * Returns the signed-in user's id (their Apple user id, which is also their
 * RevenueCat app_user_id), or sends 401 and returns null.
 */
export async function requireUser(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const userId = token ? await verifySession(token) : null;
  if (!userId) {
    sendError(res, 401, 'UNAUTHORIZED', 'Please sign in again');
    return null;
  }
  return userId;
}
