import React, { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Redirect, Tabs } from 'expo-router';
import { House, Calendar, PoundSterling, DollarSign, UserRound } from 'lucide-react-native';
import { useTheme } from '@/lib/theme';
import { useTradeStore, useRegion } from '@/lib/store';

export default function TabLayout() {
  const hasHydrated = useSyncExternalStore(
    (onChange) => useTradeStore.persist.onFinishHydration(onChange),
    () => useTradeStore.persist.hasHydrated(),
  );
  const hasCompletedOnboarding = useTradeStore((s) => s.hasCompletedOnboarding);
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const isUS = useRegion().country === 'US';
  const MoneyIcon = isUS ? DollarSign : PoundSterling;

  // Wait for saved data to load before deciding, so existing users never flash onboarding
  if (!hasHydrated) return null;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: t.link,
        tabBarInactiveTintColor: t.secondary,
        tabBarStyle: {
          backgroundColor: t.surface,
          borderTopColor: t.divider,
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 16,
          paddingTop: 8,
          zIndex: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: t.bg,
        },
        headerTintColor: t.fg,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color }) => <House size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: isUS ? 'Schedule' : 'Diary',
          headerShown: false,
          tabBarIcon: ({ color }) => <Calendar size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Money',
          headerShown: false,
          tabBarIcon: ({ color }) => <MoneyIcon size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Account',
          headerShown: false,
          tabBarIcon: ({ color }) => <UserRound size={24} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
    {/* A solid bar behind the clock, so pages never scroll under it */}
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: t.bg }} />
    </View>
  );
}
