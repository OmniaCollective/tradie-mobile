import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { palettes, themeVars, useColorMode } from '@/lib/theme';
import { useAuthSync } from '@/lib/auth';
import {
  registerForPushNotificationsAsync,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from '@/lib/notifications';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();


function RootLayoutNav() {
  const router = useRouter();
  useAuthSync();
  const mode = useColorMode();
  const p = palettes[mode];
  const navigationTheme = useMemo(() => {
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, background: p.bg, card: p.bg, text: p.fg, border: p.divider, primary: p.link },
    };
  }, [mode, p]);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);
  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync().then((token) => {
      if (token) {
        if (__DEV__) console.log('[Notifications] Push token registered:', token);
      }
    });

    // Handle notification received while app is in foreground
    notificationListener.current = addNotificationReceivedListener((notification) => {
      if (__DEV__) console.log('[Notifications] Received:', notification.request.content.title);
    });

    // Handle notification responses (when user taps notification)
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;

      // Navigate based on notification type
      if (data?.jobId) {
        router.push(`/job/${data.jobId}`);
      } else if (data?.type === 'new_booking') {
        router.push('/(tabs)');
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    // themeVars feeds the token classes (bg-bg, text-fg, …) for the current mode.
    <View style={[{ flex: 1, backgroundColor: p.bg }, themeVars[mode]]}>
    <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
    <ThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="job/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Job',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: p.bg },
            headerTintColor: p.fg,
            headerShadowVisible: false,
          }}
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
          name="paywall"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
    </ThemeProvider>
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

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