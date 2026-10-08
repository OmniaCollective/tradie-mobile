import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { palettes, themeVars, useColorMode, applyAppearance } from '@/lib/theme';
import { useAuthSync } from '@/lib/auth';
import { useNudgeSync } from '@/lib/useNudgeSync';
import { useTradeStore, useHasHydrated } from '@/lib/store';
import { addNotificationResponseListener } from '@/lib/notifications';
import { ToastHost } from '@/components/Toast';
import { CloseButton } from '@/components/ui';
import { startAnalytics } from '@/lib/analytics';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  const router = useRouter();
  useAuthSync();
  useNudgeSync();
  useEffect(() => startAnalytics(), []);
  const mode = useColorMode();
  const p = palettes[mode];
  const navigationTheme = useMemo(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: p.bg, card: p.bg, text: p.fg, border: p.divider, primary: p.link },
    };
  }, [mode, p]);
  // The tradie's Appearance choice (Account) overrides the iPhone's light/dark setting.
  const appearance = useTradeStore((s) => s.settings.appearance);
  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  // The splash stays up until saved data has loaded, then the stack opens straight on
  // Welcome or the tabs. No redirect at launch, so an early tap can't land mid-swap.
  const hasHydrated = useHasHydrated();
  const hasCompletedOnboarding = useTradeStore((s) => s.hasCompletedOnboarding);
  useEffect(() => {
    if (hasHydrated) SplashScreen.hideAsync();
  }, [hasHydrated]);

  // Tapping a reminder opens the job, or the Jobs tab for the daily nudge.
  useEffect(() => {
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      if (typeof data?.jobId === 'string') router.push(`/job/${data.jobId}`);
      else if (data?.type === 'daily_reminder') router.push('/(tabs)/calendar');
      else if (data?.type === 'renewal') router.push('/account/insurance');
    });
    return () => subscription.remove();
  }, [router]);

  if (!hasHydrated) return null;

  return (
    // themeVars feeds the token classes (bg-bg, text-fg, …) for the current mode.
    <View style={[{ flex: 1, backgroundColor: p.bg }, themeVars[mode]]}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <ThemeProvider value={navigationTheme}>
        <Stack>
          <Stack.Protected guard={!hasCompletedOnboarding}>
            <Stack.Screen
              name="onboarding"
              options={{
                headerShown: false,
              }}
            />
          </Stack.Protected>
          <Stack.Protected guard={hasCompletedOnboarding}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="job/[id]"
              options={({ navigation }) => ({
                // A job opens on top of where you were, and the X puts you back there.
                presentation: 'modal',
                headerShown: true,
                headerTitle: 'Job',
                headerLeft: () => null,
                headerRight: () => (
                  <CloseButton plain onPress={() => (navigation.canGoBack() ? navigation.goBack() : router.replace('/(tabs)'))} />
                ),
                headerStyle: { backgroundColor: p.bg },
                headerTintColor: p.fg,
                headerShadowVisible: false,
              })}
            />
            <Stack.Screen
              name="add-job"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="add-expense"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="suggest-times"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="preview"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="paywall"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen name="search" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="customer/[id]" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="account/[page]" options={{ presentation: 'modal', headerShown: false }} />
          </Stack.Protected>
        </Stack>
        <ToastHost />
      </ThemeProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <RootLayoutNav />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
