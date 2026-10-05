import { DarkTheme, ThemeProvider } from 'expo-router/react-navigation';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { DARK_BG, TURQUOISE, TEXT_PRIMARY } from '@/lib/theme';
import {
  registerForPushNotificationsAsync,
  addNotificationResponseListener,
  addNotificationReceivedListener,
} from '@/lib/notifications';

export const unstable_settings = {
  initialRouteName: 'onboarding',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();


const TradieDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: DARK_BG,
    card: DARK_BG,
    primary: TURQUOISE,
  },
};

function RootLayoutNav() {
  const router = useRouter();
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
    <ThemeProvider value={TradieDarkTheme}>
      <Stack>
        <Stack.Screen
          name="onboarding"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="send-link"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="job/[id]"
          options={{
            headerShown: true,
            headerTitle: 'Job Details',
            headerBackTitle: 'Back',
            headerStyle: { backgroundColor: DARK_BG },
            headerTintColor: TEXT_PRIMARY,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="book/[id]"
          options={{
            headerShown: false,
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
          name="paywall"
          options={{
            presentation: 'modal',
            headerShown: false,
          }}
        />
      </Stack>
    </ThemeProvider>
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
          <StatusBar style="light" />
          <RootLayoutNav />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}