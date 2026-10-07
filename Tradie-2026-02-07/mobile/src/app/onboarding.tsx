import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, Linking, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Mic,
  CalendarCheck,
  Banknote,
  FileText,
  PoundSterling,
  DollarSign,
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
import { useTradeStore, useRegion, useSettings } from '@/lib/store';
import { type Trade, getTradeConfig } from '@/lib/trades';
import { COUNTRY_OPTIONS, type Country } from '@/lib/region';
import { useAccount, useAuthStore } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { VOICE_ENABLED } from '@/lib/features';
import { Group, RowDivider, PrimaryButton, FieldRow, NumberFieldRow, SectionHeader, Segmented } from '@/components/ui';
import { AppleSignInButton } from '@/components/AppleSignInButton';
import { currencySymbol } from '@/lib/money';

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

// Led by the biggest worries for solo traders: getting paid, then time, then admin and tax.
const benefits = (country: Country): { icon: LucideIcon; title: string; body: string }[] => [
  { icon: Banknote, title: 'Get paid on time', body: 'Invoices with due dates, and one tap to chase late payers' },
  {
    icon: CalendarCheck,
    title: 'Book jobs that fit your day',
    body: country === 'US' ? 'Around your schedule and drive' : 'Around your diary and drive',
  },
  ...(VOICE_ENABLED ? [{ icon: Mic, title: 'Add a job by voice', body: 'Say it once, the details fill themselves in' }] : []),
  { icon: FileText, title: 'Quote and invoice in a tap', body: 'Professional PDFs from your own prices' },
  {
    icon: country === 'US' ? DollarSign : PoundSterling,
    title: 'Your tax, worked out',
    body: 'What to set aside, live',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const account = useAccount();
  const setTrade = useTradeStore((s) => s.setTrade);
  const updateSettings = useTradeStore((s) => s.updateSettings);
  const completeOnboarding = useTradeStore((s) => s.completeOnboarding);
  const setCountry = useTradeStore((s) => s.setCountry);
  // Starts as the phone's region; the tradie can change it on the details step.
  const { country, postcodeLabel } = useRegion();
  const isUS = country === 'US';
  // Rates start as the trade's defaults and are edited in place, like in Account.
  const { hourlyRate, minimumCharge } = useSettings();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [trade, setTradeChoice] = useState<Trade | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [postcode, setPostcode] = useState('');

  const goToTrade = () => {
    // Apple shares the name on first sign-in; use it so they don't type it again.
    if (!name && useAuthStore.getState().account?.name) setName(useAuthStore.getState().account!.name!);
    setStep(1);
  };

  const finish = (withDetails: boolean) => {
    const updates: Parameters<typeof updateSettings>[0] = { ownerName: name.trim() || account?.name || '' };
    if (withDetails) {
      if (businessName.trim()) updates.businessName = businessName.trim();
      if (phone.trim()) updates.phone = phone.trim();
      if (postcode.trim()) updates.postcode = postcode.trim().toUpperCase();
    }
    updateSettings(updates);
    setCountry(country); // saves the choice, so a later change of phone region doesn't move them
    completeOnboarding();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/(tabs)');
  };

  const back = (
    <View className="flex-row items-center justify-between mb-6">
      <Pressable
        onPress={() => setStep((s) => (s === 2 ? 1 : 0))}
        className="w-11 h-11 -ml-2.5 items-center justify-center"
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={24} color={t.fg} strokeWidth={2} />
      </Pressable>
      <Text className="text-secondary text-sm">Step {step + 1} of 3</Text>
    </View>
  );

  // ── 1. Welcome ────────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <View className="flex-1 bg-bg px-6" style={{ paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }}>
        {/* Scrolls on small iPhones; the sign-in buttons stay put */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
          {/* App icon as the logo, with the wordmark in the text colour (black on light, white on dark) */}
          <Image
            source={require('@/assets/app-icon-tile.png')}
            style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 14 }}
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <Text className="text-fg text-[17px] font-extrabold tracking-[2.4px] mb-4">TRADIE</Text>
          <Text className="text-fg text-[34px] leading-[38px] font-bold tracking-tight">Quotes, jobs and invoices. Sorted.</Text>
          <Text className="text-secondary text-[17px] leading-6 mt-4">
            Built for solo traders.{'\n'}Know what to set aside for tax as you go.
          </Text>

          <View className="mt-8 gap-4">
            {benefits(country).map(({ icon: Icon, title, body }) => (
              <View key={title} className="flex-row">
                <Icon size={24} color={t.link} strokeWidth={2} />
                <View className="ml-3.5 flex-1">
                  <Text className="text-fg text-base font-semibold">{title}</Text>
                  <Text className="text-secondary text-[15px]">{body}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View>
          <AppleSignInButton onSignedIn={goToTrade} />
          <Pressable
            onPress={() => {
              useAuthStore.getState().skipSignIn();
              goToTrade();
            }}
            className="min-h-[48px] items-center justify-center mt-2"
            accessibilityRole="button"
          >
            <Text className="text-fg text-base font-semibold">Not now</Text>
          </Pressable>
          <Text className="text-secondary text-xs text-center leading-5 mt-1">
            Signing in keeps Pro on a new phone and turns on drive times. Your jobs stay on your phone.{' '}
            <Text
              className="text-link"
              onPress={() => Linking.openURL('https://omniacollective.github.io/tradie-legal/privacy.html')}
            >
              Privacy
            </Text>
          </Text>
        </View>
      </View>
    );
  }

  // ── 2. Trade ──────────────────────────────────────────────────────────────
  if (step === 1) {
    const list = showMore ? [...TOP_TRADES, ...MORE_TRADES] : TOP_TRADES;
    return (
      <View className="flex-1 bg-bg">
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 140 }}>
          {back}
          <Text className="text-fg text-[28px] font-bold tracking-tight mx-1">What’s your trade?</Text>
          <Text className="text-secondary text-base leading-6 mt-1.5 mb-6 mx-1">
            We’ll set up your job types and starting prices. You can change them any time.
          </Text>
          <Group>
            {list.map(({ key, icon: Icon }, i) => {
              const selected = trade === key;
              return (
                <View key={key}>
                  {i > 0 && <RowDivider />}
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync();
                      setTradeChoice(key);
                    }}
                    className="flex-row items-center px-4 min-h-[56px] active:opacity-70"
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                  >
                    <Icon size={20} color={selected ? t.link : t.secondary} strokeWidth={2} />
                    <View className="flex-1 ml-3.5 py-2">
                      <Text className={selected ? 'text-fg text-base font-semibold' : 'text-fg text-base'}>
                        {getTradeConfig(key, country).label}
                      </Text>
                      <Text className="text-secondary text-[13px]">{getTradeConfig(key, country).description}</Text>
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
            label="Continue"
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

  // ── 3. Details ────────────────────────────────────────────────────────────
  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: 180 }}
      >
        {back}
        <Text className="text-fg text-[28px] font-bold tracking-tight mx-1">Your details</Text>
        <Text className="text-secondary text-base leading-6 mt-1.5 mb-6 mx-1">These go on your quotes and invoices.</Text>
        <Group>
          <View className="flex-row items-center px-4 min-h-[52px] py-2">
            <Text className="flex-1 text-fg text-base">Country</Text>
            <Segmented options={COUNTRY_OPTIONS} value={country} onChange={setCountry} className="w-32 bg-bg" />
          </View>
          <RowDivider />
          <FieldRow
            label="Your name"
            value={name}
            onChangeText={setName}
            placeholder="First and last"
            autoCapitalize="words"
            width="w-44"
          />
          <RowDivider />
          <FieldRow
            label="Business name"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder={isUS ? 'As on your truck' : 'As on your van'}
            autoCapitalize="words"
            width="w-44"
          />
          <RowDivider />
          <FieldRow
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            placeholder={isUS ? '(555) 555-0100' : '07700 900000'}
            keyboardType="phone-pad"
            width="w-40"
          />
          <RowDivider />
          <FieldRow
            label={isUS ? 'Base ZIP code' : 'Base postcode'}
            hint="Where your day starts"
            value={postcode}
            onChangeText={(v) => setPostcode(v.toUpperCase())}
            placeholder={isUS ? '94103' : 'SE1 7TP'}
            autoCapitalize="characters"
            keyboardType={isUS ? 'number-pad' : 'default'}
            width="w-28"
          />
        </Group>
        <Text className="text-secondary text-[13px] mx-1 mt-2">
          Your {postcodeLabel} lets Tradie suggest times that keep your driving down.
        </Text>

        <View className="mt-8">
          <SectionHeader title="Your rates" />
        </View>
        <Group>
          <NumberFieldRow
            label="Hourly rate"
            prefix={currencySymbol()}
            value={hourlyRate}
            onChangeNumber={(n) => updateSettings({ hourlyRate: n })}
            width="w-20"
          />
          <RowDivider />
          <NumberFieldRow
            label="Minimum charge"
            prefix={currencySymbol()}
            value={minimumCharge}
            onChangeNumber={(n) => updateSettings({ minimumCharge: n })}
            width="w-20"
          />
        </Group>
        <Text className="text-secondary text-[13px] mx-1 mt-2">
          Starting rates for your trade. Set prices for each job type in Account.
        </Text>
      </ScrollView>
      <View className="absolute left-0 right-0 bottom-0 bg-bg px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
        <PrimaryButton label="Let’s go" onPress={() => finish(true)} />
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
