/**
 * Bottom sheet shown when a free user reaches a limit. Explains the limit in
 * one line and offers Pro; never blocks the rest of the app.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, Mic } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FREE_LIMITS } from '@/lib/useProAccess';
import { useTheme } from '@/lib/theme';
import { PrimaryButton, Sheet } from '@/components/ui';

export type LimitedFeature = 'invoices' | 'voice';

const CONTENT: Record<LimitedFeature, { icon: typeof FileText; title: string; body: string }> = {
  invoices: {
    icon: FileText,
    title: `You’ve used this month’s ${FREE_LIMITS.invoicesPerMonth} free invoices`,
    body: 'Pro gives you unlimited invoices, plus the tax tracker and expenses. Your free invoices reset on the 1st.',
  },
  voice: {
    icon: Mic,
    title: `You’ve used your ${FREE_LIMITS.voiceJobs} free voice jobs`,
    body: 'Pro gives you unlimited voice jobs, plus unlimited invoices and the tax tracker. You can still type jobs in for free.',
  },
};

export function UpgradePrompt({ visible, onClose, feature }: { visible: boolean; onClose: () => void; feature: LimitedFeature }) {
  const router = useRouter();
  const t = useTheme();
  const { icon: Icon, title, body } = CONTENT[feature];

  const upgrade = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    router.push('/paywall');
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View className="pt-1">
        <View className="items-center mb-4">
          <Icon size={24} color={t.link} strokeWidth={2} />
        </View>
        <Text className="text-fg text-[20px] font-semibold text-center mb-2">{title}</Text>
        <Text className="text-secondary text-[15px] leading-5 text-center mb-6">{body}</Text>
        <PrimaryButton label="See Tradie Pro" onPress={upgrade} />
        <Pressable onPress={onClose} className="min-h-[48px] items-center justify-center mt-1" accessibilityRole="button">
          <Text className="text-secondary text-base font-semibold">Not now</Text>
        </Pressable>
      </View>
    </Sheet>
  );
}
