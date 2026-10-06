/**
 * Calls to Tradie's own server (Tradie-2026-02-07/server, hosted on Vercel).
 * The session token comes from Sign in with Apple and lives in the Keychain.
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://tradie-api-three.vercel.app';

const TOKEN_KEY = 'tradie.session';

/** Thrown for any failed call; `code` matches the server's error codes. */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// SecureStore has no web implementation; the web preview keeps the token in memory.
let webToken: string | null = null;

export async function getSessionToken(): Promise<string | null> {
  if (Platform.OS === 'web') return webToken;
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setSessionToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    webToken = token;
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/** Called when the server says the session is no longer valid. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/**
 * POST to the server. JSON body by default; pass FormData for uploads.
 * Resolves with the response's `data`, or throws ApiError.
 */
export async function apiPost<T>(path: string, body: unknown, { auth = true } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (auth) {
    const token = await getSessionToken();
    if (!token) throw new ApiError('UNAUTHORIZED', 'Please sign in', 401);
    headers.Authorization = `Bearer ${token}`;
  }
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (!isForm) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('NETWORK', 'No internet connection', 0);
  }

  const json = (await res.json().catch(() => null)) as { data?: T; error?: { code: string; message: string } } | null;
  if (!res.ok || !json || json.error) {
    const code = json?.error?.code ?? 'UPSTREAM_ERROR';
    if (code === 'UNAUTHORIZED' && auth) onUnauthorized?.();
    throw new ApiError(code, json?.error?.message ?? 'Something went wrong', res.status);
  }
  return json.data as T;
}
