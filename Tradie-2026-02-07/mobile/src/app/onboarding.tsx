import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  FileText,
  ListChecks,
  Banknote,
  PoundSterling,
  DollarSign,
  ShieldCheck,
  Wrench,
  Zap,
  Leaf,
  Sparkles,
  Hammer,
  Dog,
  Droplets,
  Car,
  Plus,
  Check,
  ChevronLeft,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTradeStore, useRegion } from '@/lib/store';
import { type Trade, getTradeConfig } from '@/lib/trades';
import { useAuthStore } from '@/lib/auth';
import { restorePurchases } from '@/lib/revenuecatClient';
import { useRefreshPro } from '@/lib/useProAccess';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, PrimaryButton, LabeledField } from '@/components/ui';
import { toast } from '@/components/Toast';
import { track } from '@/lib/analytics';

const TOP_TRADES: { key: Trade; icon: LucideIcon }[] = [
  { key: 'plumber', icon: Wrench },
  { key: 'electrician', icon: Zap },
  { key: 'gardener', icon: Leaf },
  { key: 'cleaner', icon: Sparkles },
  { key: 'diy', icon: Hammer },
];
const MORE_TRADES: { key: Trade; icon: LucideIcon }[] = [
  { key: 'carpenter', icon: Hammer },
  { key: 'window_cleaner', icon: Droplets },
  { key: 'carpet_cleaner', icon: Sparkles },
  { key: 'car_valet', icon: Car },
  { key: 'dog_walker', icon: Dog },
];

// In the order a job goes, then the reassurance (agreed copy, release/ux-journey-review.md).
const benefits = (isUS: boolean): { icon: LucideIcon; title: string; body: string }[] => [
  { icon: FileText, title: 'Quote in minutes', body: 'From your own prices, sent as a PDF' },
  { icon: ListChecks, title: 'Know where every job is', body: 'Quoted, booked, invoiced or paid' },
  { icon: Banknote, title: 'Get paid on time', body: 'Due dates, reminders and one tap to chase' },
  { icon: isUS ? DollarSign : PoundSterling, title: 'Your tax, worked out', body: 'What to set aside, as you go (Pro)' },
  {
    icon: ShieldCheck,
    title: 'Never miss a renewal',
    body: isUS ? 'Insurance and licenses with reminders' : 'Insurance and licences with reminders',
  },
];

/** Two short steps after Welcome; the bars show where you are. */
function StepBars({ step }: { step: 1 | 2 }) {
  return (
    <View className="flex-row gap-1.5" accessibilityLabel={`Step ${step} of 2`}>
      <View className="w-6 h-1 rounded-full bg-accent" />
      <View className={cn('w-6 h-1 rounded-full', step === 2 ? 'bg-accent' : 'bg-divider')} />
    </View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const refreshPro = useRefreshPro();
  const setTrade = useTradeStore((s) => s.setTrade);
  const updateSettings = useTradeStore((s) => s.updateSettings);
  const completeOnboarding = useTradeStore((s) => s.completeOnboarding);
  const setCountry = useTradeStore((s) => s.setCountry);
  // Starts as the phone's region; "Change" switches it.
  const { country } = useRegion();
  const isUS = country === 'US';

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [trade, setTradeChoice] = useState<Trade | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [restoring, setRestoring] = useState(false);

  const getStarted = () => {
    // Sign in is offered later, when it helps (buying Pro, drive times).
    useAuthStore.getState().skipSignIn();
    setStep(1);
  };

  const restore = async () => {
    setRestoring(true);
    const result = await restorePurchases();
    setRestoring(false);
    if (!result.ok) {
      toast('Couldn’t check. Try again with a connection.');
      return;
    }
    await refreshPro();
    if (result.data.entitlements.active.pro) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast('Pro restored');
    } else {
      toast('No Tradie Pro on this Apple ID');
    }
    getStarted();
  };

  const finish = (withDetails: boolean) => {
    if (withDetails) {
      const updates: Parameters<typeof updateSettings>[0] = {};
      if (name.trim()) updates.ownerName = name.trim();
      if (businessName.trim()) updates.businessName = businessName.trim();
      if (phone.trim()) updates.phone = phone.trim();
      updateSettings(updates);
    }
    setCountry(country); // saves the choice, so a later change of phone region doesn't move them
    completeOnboarding();
    track('setup_finished');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  const topBar = (current: 1 | 2) => (
    <View className="flex-row items-center justify-between mb-5">
      <Pressable
        onPress={() => setStep((s) => (s === 2 ? 1 : 0))}
        className="w-11 h-11 -ml-2.5 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={24} color={t.fg} strokeWidth={2} />
      </Pressable>
      <StepBars step={current} />
      <View className="w-11" />
    </View>
  );

  // ── Welcome ───────────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <View className="flex-1 bg-bg px-6" style={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 16 }}>
        {/* Scrolls on small iPhones and with larger text; the button stays put */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          <Image
            source={require('@/assets/app-icon-tile.png')}
            style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 14 }}
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <Text className="text-fg text-[17px] font-extrabold tracking-[2.4px] mb-4" accessibilityRole="header">
            TRADIE
          </Text>
          <Text className="text-fg text-[34px] leading-[38px] font-bold tracking-tight">
            {isUS ? 'Quotes, jobs and invoices. Handled.' : 'Quotes, jobs and invoices. Sorted.'}
          </Text>
          <Text className="text-secondary text-[17px] leading-6 mt-3">Built for solo traders.</Text>

          <View className="mt-7 gap-4">
            {benefits(isUS).map(({ icon: Icon, title, body }) => (
              <View key={title} className="flex-row" accessible accessibilityLabel={`${title}. ${body}`}>
                <Icon size={24} color={t.link} strokeWidth={2} />
                <View className="ml-3.5 flex-1">
                  <Text className="text-fg text-base font-semibold">{title}</Text>
                  <Text className="text-secondary text-[15px]">{body}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <PrimaryButton label="Get started" onPress={getStarted} />
        <View className="flex-row justify-center items-center mt-1">
          <Text className="text-secondary text-sm">Have Pro already? </Text>
          <Pressable onPress={restore} disabled={restoring} className="min-h-[44px] justify-center" accessibilityRole="button">
            <Text className="text-link text-sm font-semibold">{restoring ? 'Checking…' : 'Restore'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Trade ─────────────────────────────────────────────────────────────────
  if (step === 1) {
    const list = showMore ? [...TOP_TRADES, ...MORE_TRADES] : TOP_TRADES;
    return (
      <View className="flex-1 bg-bg">
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 140 }}>
          {topBar(1)}
          <Text className="text-fg text-[28px] font-bold tracking-tight mx-1" accessibilityRole="header">
            What’s your trade?
          </Text>
          <Text className="text-secondary text-base leading-6 mt-1.5 mb-6 mx-1">
            We’ll set up your job types and prices. You can change them any time.
          </Text>
          <Group>
            {list.map(({ key, icon: Icon }, i) => {
              const selected = trade === key;
              const cfg = getTradeConfig(key, country);
              return (
                <View key={key}>
                  {i > 0 && <RowDivider />}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setTradeChoice(key);
                    }}
                    className="flex-row items-center px-4 min-h-[58px] active:opacity-70"
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    accessibilityLabel={`${cfg.label}. ${cfg.description}`}
                  >
                    <Icon size={20} color={selected ? t.link : t.secondary} strokeWidth={2} />
                    <View className="flex-1 ml-3.5 py-2">
                      <Text className={selected ? 'text-fg text-base font-semibold' : 'text-fg text-base'}>{cfg.label}</Text>
                      <Text className="text-secondary text-[13px]">{cfg.description}</Text>
                    </View>
                    {selected && <Check size={20} color={t.link} strokeWidth={2.25} />}
                  </Pressable>
                </View>
              );
            })}
            <RowDivider />
            {showMore ? (
              <Pressable
                onPress={() => setTradeChoice('custom')}
                className="flex-row items-center px-4 min-h-[56px] active:opacity-70"
                accessibilityRole="radio"
                accessibilityState={{ checked: trade === 'custom' }}
              >
                <Plus size={20} color={t.link} strokeWidth={2} />
                <Text className="flex-1 text-link text-base font-semibold ml-3.5">Something else</Text>
                {trade === 'custom' && <Check size={20} color={t.link} strokeWidth={2.25} />}
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setShowMore(true)}
                className="flex-row items-center px-4 min-h-[52px] active:opacity-70"
                accessibilityRole="button"
              >
                <ChevronDown size={20} color={t.link} strokeWidth={2} />
                <Text className="text-link text-base font-semibold ml-3.5">More trades</Text>
              </Pressable>
            )}
          </Group>
        </ScrollView>
        <View className="absolute left-0 right-0 bottom-0 bg-bg px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <PrimaryButton
            label={trade ? 'Continue' : 'Pick your trade'}
            disabled={!trade}
            onPress={() => {
              if (!trade) return;
              setTrade(trade);
              setStep(2);
            }}
          />
        </View>
      </View>
    );
  }

  // ── About your business ───────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 180 }}
      >
        {topBar(2)}
        <Text className="text-fg text-[28px] font-bold tracking-tight mx-1" accessibilityRole="header">
          About your business
        </Text>
        <Text className="text-secondary text-base leading-6 mt-1.5 mb-6 mx-1">This goes on your quotes and invoices.</Text>
        <View className="gap-4">
          <LabeledField
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Dave Smith"
            autoCapitalize="words"
            textContentType="name"
          />
          <LabeledField
            label="Business name"
            optional
            value={businessName}
            onChangeText={setBusinessName}
            placeholder={isUS ? 'As on your truck' : 'As on your van'}
            autoCapitalize="words"
            textContentType="organizationName"
          />
          <LabeledField
            label="Mobile"
            value={phone}
            onChangeText={setPhone}
            placeholder="So customers can reach you"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
        </View>
        <View className="flex-row items-center flex-wrap mx-1 mt-4">
          <Text className="text-secondary text-sm">
            Working in {isUS ? 'the US' : 'the UK'} · prices in {isUS ? 'dollars' : 'pounds'}{' '}
          </Text>
          <Pressable
            onPress={() => setCountry(isUS ? 'GB' : 'US')}
            className="min-h-[44px] justify-center"
            accessibilityRole="button"
            accessibilityLabel={`Change country. Now ${isUS ? 'the US' : 'the UK'}`}
          >
            <Text className="text-link text-sm font-semibold">Change</Text>
          </Pressable>
        </View>
      </ScrollView>
      <View className="absolute left-0 right-0 bottom-0 bg-bg px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <PrimaryButton label="Start using Tradie" onPress={() => finish(true)} />
        <Pressable
          onPress={() => finish(false)}
          className="min-h-[48px] items-center justify-center mt-1"
          accessibilityRole="button"
        >
          <Text className="text-secondary text-base font-semibold">Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}
