/**
 * A one-off tip, shown once where it matters and closed with an X. It never comes back
 * unless the tradie taps "Show tips again" (Account → Help and legal).
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Info, X } from 'lucide-react-native';
import { useTradeStore, type TipKey } from '@/lib/store';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';

export function Tip({ id, text, className }: { id: TipKey; text: string; className?: string }) {
  const t = useTheme();
  const seen = useTradeStore((s) => (s.settings.tipsSeen ?? []).includes(id));
  if (seen) return null;
  const close = () => {
    const { settings, updateSettings } = useTradeStore.getState();
    updateSettings({ tipsSeen: [...new Set([...(settings.tipsSeen ?? []), id])] });
  };
  return (
    <View className={cn('bg-surface rounded-2xl flex-row items-start pl-4 py-3 pr-1', className)} accessibilityRole="summary">
      <Info size={20} color={t.link} strokeWidth={2} style={{ marginTop: 1 }} />
      <Text className="flex-1 text-fg text-[15px] leading-5 ml-3 mt-0.5">{text}</Text>
      <Pressable
        onPress={close}
        hitSlop={6}
        className="w-11 h-11 -mt-2 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Close tip"
      >
        <X size={18} color={t.secondary} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
