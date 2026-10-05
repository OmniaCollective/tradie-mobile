import React, { useSyncExternalStore } from 'react';
import { Redirect, Tabs } from 'expo-router';
import { Home, Calendar, FileText, Settings } from 'lucide-react-native';
import { View } from 'react-native';
import { TURQUOISE, DARK_BG, BORDER, SLATE_500, TEXT_PRIMARY } from '@/lib/theme';
import { useTradeStore } from '@/lib/store';


export default function TabLayout() {
  const hasHydrated = useSyncExternalStore(
    (onChange) => useTradeStore.persist.onFinishHydration(onChange),
    () => useTradeStore.persist.hasHydrated(),
  );
  const hasCompletedOnboarding = useTradeStore((s) => s.hasCompletedOnboarding);

  // Wait for saved data to load before deciding, so existing users never flash onboarding
  if (!hasHydrated) return null;
  if (!hasCompletedOnboarding) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TURQUOISE,
        tabBarInactiveTintColor: SLATE_500,
        tabBarStyle: {
          backgroundColor: DARK_BG,
          borderTopColor: BORDER,
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
          backgroundColor: DARK_BG,
        },
        headerTintColor: TEXT_PRIMARY,
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
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => <Calendar size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finances',
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
