/**
 * Short "it worked" confirmation after an action ("Job saved", "Marked as paid").
 * Call toast('…') from anywhere; <ToastHost /> in the root layout shows it for
 * two seconds above the tab bar and VoiceOver reads it out.
 */
import React, { useEffect } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { CircleCheck } from 'lucide-react-native';
import { useTheme, palettes } from '@/lib/theme';

const SHOW_MS = 2000;

const useToast = create<{ message: string | null; key: number; show: (m: string) => void; hide: () => void }>()((set) => ({
  message: null,
  key: 0,
  show: (message) => set((s) => ({ message, key: s.key + 1 })),
  hide: () => set({ message: null }),
}));

/** Shows a confirmation, e.g. toast('Job saved'). */
export function toast(message: string) {
  useToast.getState().show(message);
  AccessibilityInfo.announceForAccessibility(message);
}

export function ToastHost() {
  const message = useToast((s) => s.message);
  const key = useToast((s) => s.key);
  const hide = useToast((s) => s.hide);
  const insets = useSafeAreaInsets();
  const t = useTheme();

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(hide, SHOW_MS);
    return () => clearTimeout(timer);
  }, [message, key, hide]);

  if (!message) return null;
  return (
    <Animated.View
      key={key}
      entering={FadeInDown.duration(180)}
      exiting={FadeOutDown.duration(180)}
      pointerEvents="none"
      // Above the tab bar on tab screens, and above the home indicator elsewhere
      style={{ position: 'absolute', left: 16, right: 16, bottom: insets.bottom + 72, alignItems: 'center' }}
    >
      {/* Inverted colours (dark pill in light mode, light pill in dark) so it stands out without a shadow */}
      <View className="flex-row items-center rounded-full px-4 py-3 bg-fg">
        <CircleCheck size={18} color={t.mode === 'dark' ? palettes.light.link : t.accent} strokeWidth={2} />
        <Text className="text-bg text-[15px] font-semibold ml-2">{message}</Text>
      </View>
    </Animated.View>
  );
}
