/**
 * Apple's own Sign in with Apple button (required by Apple's design rules):
 * black in light mode, white in dark. Handles the whole sign-in, including
 * refreshing Pro, and reports friendly errors.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import { signInWithApple, isAppleSignInAvailable } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { useRefreshPro } from '@/lib/useProAccess';
import { useTheme } from '@/lib/theme';

export function AppleSignInButton({ onSignedIn, label = 'continue' }: { onSignedIn?: () => void; label?: 'continue' | 'signIn' }) {
  const t = useTheme();
  const refreshPro = useRefreshPro();
  const [available, setAvailable] = useState(Platform.OS === 'ios');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAppleSignInAvailable().then(setAvailable);
  }, []);

  if (!available) {
    return <Text className="text-secondary text-sm text-center">Sign in with Apple is available on iPhone.</Text>;
  }

  const run = async () => {
    setError(null);
    setBusy(true);
    try {
      if (await signInWithApple()) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refreshPro();
        onSignedIn?.();
      }
    } catch (e) {
      if (__DEV__) console.error('Sign in failed:', e);
      setError(
        e instanceof ApiError && e.code === 'NETWORK'
          ? 'No internet connection. Try again when you’re back online.'
          : 'Sign in didn’t work. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <View className="h-[52px]">
        {busy ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={t.fg} />
          </View>
        ) : (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={
              label === 'signIn'
                ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
            }
            buttonStyle={
              t.mode === 'dark'
                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
            }
            cornerRadius={12}
            style={{ flex: 1 }}
            onPress={run}
          />
        )}
      </View>
      {error && <Text className="text-alert text-sm text-center mt-2">{error}</Text>}
    </View>
  );
}
