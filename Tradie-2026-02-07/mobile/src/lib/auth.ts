/**
 * Sign in with Apple.
 *
 * Signing in links the person to RevenueCat (so Pro follows them to a new phone
 * and they show up by name in the RevenueCat dashboard) and unlocks the server
 * features: voice jobs and drive times. Jobs and customers stay on the phone.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { apiPost, setSessionToken, readSessionToken, setUnauthorizedHandler } from './api';
import { setUserId, setUserDetails, logoutUser } from './revenuecatClient';

interface Account {
  userId: string;
  name?: string;
  email?: string;
}

interface AuthState {
  account: Account | null;
  /** Set when the person tapped "Not now" on the sign-in screen. */
  skippedSignIn: boolean;
  setAccount: (account: Account | null) => void;
  skipSignIn: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      account: null,
      skippedSignIn: false,
      setAccount: (account) => set({ account, skippedSignIn: false }),
      skipSignIn: () => set({ skippedSignIn: true }),
    }),
    { name: 'tradie-auth', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const useAccount = () => useAuthStore((s) => s.account);

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
}

function fullName(name: AppleAuthentication.AppleAuthenticationFullName | null): string | undefined {
  const joined = [name?.givenName, name?.familyName].filter(Boolean).join(' ').trim();
  return joined || undefined;
}

/**
 * Runs the Apple sheet, swaps the identity token for a Tradie session and links
 * RevenueCat. Resolves false if the person cancelled; throws on real failures.
 */
export async function signInWithApple(): Promise<boolean> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw error;
  }
  if (!credential.identityToken) throw new Error('Apple did not return an identity token');

  const { token, userId } = await apiPost<{ token: string; userId: string }>(
    '/api/auth/apple',
    { identityToken: credential.identityToken },
    { auth: false },
  );
  await setSessionToken(token);

  // Apple only shares name and email the first time; keep what we already had.
  const previous = useAuthStore.getState().account;
  const account: Account = {
    userId,
    name: fullName(credential.fullName) ?? (previous?.userId === userId ? previous.name : undefined),
    email: credential.email ?? (previous?.userId === userId ? previous.email : undefined),
  };
  useAuthStore.getState().setAccount(account);

  await setUserId(userId);
  await setUserDetails({ email: account.email, displayName: account.name });
  return true;
}

export async function signOut(): Promise<void> {
  await setSessionToken(null);
  useAuthStore.getState().setAccount(null);
  await logoutUser();
}

/**
 * Apple requires in-app account deletion to revoke Sign in with Apple. Apple
 * asks the person to confirm once more, which gives a fresh authorization code
 * for the server to revoke with; the server also deletes the RevenueCat customer.
 * Resolves false if they cancelled the Apple sheet.
 */
export async function deleteAccount(): Promise<boolean> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') return false;
    throw error;
  }
  if (!credential.authorizationCode) throw new Error('Apple did not return an authorization code');
  await apiPost('/api/account/delete', { authorizationCode: credential.authorizationCode });
  await signOut();
  return true;
}

/**
 * Keeps the app and RevenueCat in step with the stored sign-in: re-links
 * RevenueCat on launch and signs out locally if the server rejects the session.
 */
export function useAuthSync() {
  const account = useAccount();
  useEffect(() => {
    setUnauthorizedHandler(() => {
      signOut();
    });
  }, []);
  useEffect(() => {
    if (!account) return;
    (async () => {
      let token: string | null;
      try {
        token = await readSessionToken();
      } catch {
        return; // Keychain unreadable for now (e.g. phone locked): stay signed in and check next time.
      }
      if (!token) {
        // Account record survived but the Keychain token didn't (e.g. restored backup).
        useAuthStore.getState().setAccount(null);
        return;
      }
      await setUserId(account.userId);
    })();
  }, [account]);
}
