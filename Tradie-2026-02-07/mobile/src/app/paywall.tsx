import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { X, Check } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { PurchasesPackage, PurchasesIntroPrice } from 'react-native-purchases';
import { getOfferings, purchasePackage, restorePurchases, isRevenueCatEnabled } from '@/lib/revenuecatClient';
import { FREE_LIMITS, useRefreshPro } from '@/lib/useProAccess';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { PrimaryButton } from '@/components/ui';
import { ConfirmModal } from '@/components/ConfirmModal';

type Plan = 'yearly' | 'monthly';

// Only what Pro actually unlocks today (App Store guideline 2.3.1).
const BENEFITS = [
  { title: 'Unlimited invoices', detail: `Free plan is ${FREE_LIMITS.invoicesPerMonth} a month` },
  { title: 'Tax set-aside and VAT tracker', detail: 'Know what to put away for HMRC' },
  { title: 'Expenses and receipts', detail: 'Tax-year exports for your accountant' },
  { title: 'Add jobs by voice', detail: 'Unlimited voice jobs' },
];

const TERMS_URL = 'https://omniacollective.github.io/tradie-legal/terms.html';
const PRIVACY_URL = 'https://omniacollective.github.io/tradie-legal/privacy.html';

/** "1 week", "3 days", "1 month" for a free trial. */
function trialLength(intro: PurchasesIntroPrice): string {
  const unit = intro.periodUnit.toLowerCase();
  const n = intro.periodNumberOfUnits;
  return `${n} ${unit}${n === 1 ? '' : 's'}`;
}

async function loadPackages(): Promise<{ monthly: PurchasesPackage | null; yearly: PurchasesPackage | null }> {
  const result = await getOfferings();
  if (!result.ok) throw new Error(result.reason);
  const available = result.data.current?.availablePackages ?? [];
  return {
    monthly: available.find((p) => p.identifier === '$rc_monthly') ?? null,
    yearly: available.find((p) => p.identifier === '$rc_annual') ?? null,
  };
}

export default function PaywallScreen() {
  const router = useRouter();
  // Opened from a link or notification there may be nothing to go back to; then go Home.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const refreshPro = useRefreshPro();
  const [plan, setPlan] = useState<Plan>('yearly');
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [modal, setModal] = useState<{ title: string; message: string; variant?: 'success' | 'error' | 'warning'; done?: boolean } | null>(null);

  const offerings = useQuery({
    queryKey: ['paywall-packages'],
    queryFn: loadPackages,
    enabled: isRevenueCatEnabled(),
    retry: 1,
  });
  const packages = offerings.data;
  const selected = packages?.[plan] ?? null;
  const ready = !!packages && (!!packages.monthly || !!packages.yearly);

  const monthly = packages?.monthly?.product;
  const yearly = packages?.yearly?.product;
  const freeMonths = monthly && yearly ? Math.round(12 - yearly.price / monthly.price) : 0;

  const options: { key: Plan; name: string; detail: string; price: string; pkg: PurchasesPackage | null | undefined }[] = [
    {
      key: 'yearly',
      name: 'Yearly',
      detail: yearly
        ? [
            yearly.introPrice?.price === 0 ? `${trialLength(yearly.introPrice)} free` : null,
            `${formatMoney(yearly.price / 12)} a month`,
            freeMonths >= 1 ? `${freeMonths} months free` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : '',
      price: yearly?.priceString ?? '',
      pkg: packages?.yearly,
    },
    {
      key: 'monthly',
      name: 'Monthly',
      detail: monthly?.introPrice?.price === 0 ? `${trialLength(monthly.introPrice)} free · cancel any time` : 'Cancel any time',
      price: monthly?.priceString ?? '',
      pkg: packages?.monthly,
    },
  ];

  const ctaLabel = (() => {
    if (!selected) return 'Start Pro';
    const intro = selected.product.introPrice;
    if (intro?.price === 0) return `Start ${trialLength(intro)} free trial`;
    return `Start Pro — ${selected.product.priceString} a ${plan === 'yearly' ? 'year' : 'month'}`;
  })();

  const buy = async () => {
    if (!selected) return;
    setBusy('buy');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await purchasePackage(selected);
    setBusy(null);
    if (result.ok) {
      // Refresh Pro everywhere straight away, not after the 5-minute cache.
      await refreshPro();
      if (result.data.entitlements.active.pro) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModal({ title: 'Welcome to Tradie Pro', message: 'Everything is unlocked.', variant: 'success', done: true });
      } else {
        setModal({
          title: 'Confirming your purchase',
          message: 'Apple has taken the payment and Pro should appear in a moment. If it doesn’t, tap Restore purchase.',
          variant: 'warning',
        });
      }
      return;
    }
    if ((result.error as { userCancelled?: boolean } | undefined)?.userCancelled) return;
    setModal({
      title: 'Purchase didn’t go through',
      message: result.reason === 'not_configured' ? 'In-app purchases aren’t available right now.' : 'You haven’t been charged. Please try again.',
      variant: 'error',
    });
  };

  const restore = async () => {
    setBusy('restore');
    const result = await restorePurchases();
    setBusy(null);
    if (!result.ok) {
      setModal({ title: 'Couldn’t restore', message: 'Check your connection and try again.', variant: 'error' });
      return;
    }
    await refreshPro();
    if (result.data.entitlements.active.pro) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModal({ title: 'Pro restored', message: 'Everything is unlocked again.', variant: 'success', done: true });
    } else {
      setModal({ title: 'No subscription found', message: 'This Apple ID doesn’t have an active Tradie Pro subscription.', variant: 'warning' });
    }
  };

  return (
    <View className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 260 }}>
        <View className="flex-row justify-end">
          <Pressable
            onPress={() => goBack()}
            className="w-11 h-11 -mr-2.5 items-center justify-center"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={24} color={t.secondary} strokeWidth={2} />
          </Pressable>
        </View>

        <View className="mx-1 mb-6">
          <Text className="text-link text-[15px] font-extrabold tracking-[2px]">TRADIE PRO</Text>
          <Text className="text-fg text-[28px] leading-[32px] font-bold tracking-tight mt-2">Get paid and stay on top of tax</Text>
        </View>

        <View className="mx-1 gap-3.5 mb-8">
          {BENEFITS.map((b) => (
            <View key={b.title} className="flex-row">
              <Check size={20} color={t.link} strokeWidth={2.25} style={{ marginTop: 1 }} />
              <View className="ml-3">
                <Text className="text-fg text-base font-semibold">{b.title}</Text>
                <Text className="text-secondary text-sm">{b.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        {!isRevenueCatEnabled() ? (
          <Text className="text-secondary text-[15px] text-center">Subscriptions are available in the iPhone app.</Text>
        ) : offerings.isLoading ? (
          <View className="py-8 items-center">
            <ActivityIndicator color={t.link} />
          </View>
        ) : !ready ? (
          <View className="py-4 items-center">
            <Text className="text-secondary text-[15px] text-center mb-2">Plans couldn’t load. Check your connection.</Text>
            <Pressable onPress={() => offerings.refetch()} className="min-h-[44px] justify-center" accessibilityRole="button">
              <Text className="text-link text-[15px] font-semibold">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-2.5">
            {options
              .filter((o) => o.pkg)
              .map((o) => {
                const on = plan === o.key;
                return (
                  <Pressable
                    key={o.key}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setPlan(o.key);
                    }}
                    className={cn('flex-row items-center bg-surface rounded-2xl px-4 min-h-[68px] border-2', on ? 'border-accent' : 'border-surface')}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                  >
                    <View className={cn('w-5 h-5 rounded-full', on ? 'border-[6px] border-accent' : 'border-2 border-divider')} />
                    <View className="flex-1 ml-3.5">
                      <Text className="text-fg text-base font-semibold">{o.name}</Text>
                      <Text className="text-secondary text-sm">{o.detail}</Text>
                    </View>
                    <Text className="text-fg text-[17px] font-bold">{o.price}</Text>
                  </Pressable>
                );
              })}
          </View>
        )}
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 bg-bg px-4 pt-3" style={{ paddingBottom: insets.bottom + 8 }}>
        <PrimaryButton label={ctaLabel} onPress={buy} loading={busy === 'buy'} disabled={!selected || busy !== null} />
        <View className="flex-row justify-center gap-5 mt-1">
          <Pressable onPress={restore} disabled={busy !== null} className="min-h-[44px] justify-center" accessibilityRole="button">
            <Text className="text-fg text-sm font-semibold">{busy === 'restore' ? 'Restoring…' : 'Restore purchase'}</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(TERMS_URL)} className="min-h-[44px] justify-center" accessibilityRole="link">
            <Text className="text-secondary text-sm">Terms of use</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} className="min-h-[44px] justify-center" accessibilityRole="link">
            <Text className="text-secondary text-sm">Privacy policy</Text>
          </Pressable>
        </View>
        <Text className="text-secondary text-xs text-center leading-4">
          Renews automatically until cancelled in your Apple ID settings at least 24 hours before the end of the period.
          Free plan: {FREE_LIMITS.invoicesPerMonth} invoices a month.
        </Text>
      </View>

      {modal && (
        <ConfirmModal
          visible={!!modal}
          title={modal.title}
          message={modal.message}
          variant={modal.variant}
          confirmText={modal.done ? 'Done' : 'OK'}
          onDismiss={() => {
            const done = modal.done;
            setModal(null);
            if (done) goBack();
          }}
        />
      )}
    </View>
  );
}
