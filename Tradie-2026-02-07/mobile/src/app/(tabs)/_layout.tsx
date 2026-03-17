import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Calendar, FileText, Settings } from 'lucide-react-native';
import { View } from 'react-native';

const TURQUOISE = '#14B8A6';
const DARK_BG = '#0F172A';
const CARD_BG = '#1E293B';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: TURQUOISE,
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: DARK_BG,
          borderTopColor: '#334155',
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
        headerTintColor: '#F8FAFC',
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
        name="invoices"
        options={{
          title: 'Invoices',
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
