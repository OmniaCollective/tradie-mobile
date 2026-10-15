/**
 * Bottom sheet shown when a free user reaches a limit. Explains the limit in
 * one line and offers Pro; never blocks the rest of the app.
 */
import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, Mic, ListPlus, Package, TrendingUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { FREE_LIMITS } from '@/lib/useProAccess';
import { useTheme } from '@/lib/theme';
import { PrimaryButton, Sheet } from '@/components/ui';

export type LimitedFeature = 'invoices' | 'voice' | 'priceList' | 'parts' | 'profit';

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
  priceList: {
    icon: ListPlus,
    title: 'Save your prices with Pro',
    body: 'Keep the items you use most, like a call-out fee or a valve, and add them to any quote in a tap.',
  },
  parts: {
    icon: Package,
    title: 'Add parts to the price with Pro',
    body: 'Pro brings the parts you’ve logged into the price in one go, with your markup added. You can still type items in for free.',
  },
  profit: {
    icon: TrendingUp,
    title: 'See your full profit with Pro',
    body: 'Pro lets you log fuel, tools and other costs against a job, so the profit shown is what you really made.',
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
