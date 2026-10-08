/**
 * Account: me, my business, my settings, as a short list. Each row shows a summary ("Not added"
 * when empty) and opens its own page (app/account/[page].tsx). Plan and sign-in sit lower down.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Database, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useTradeStore, useSettings, usePricingPresets, useRenewals, useRegion, reminderPrefs, daysUntil } from '@/lib/store';
import { cancelAllReminders } from '@/lib/notifications';
import { useProAccess } from '@/lib/useProAccess';
import { useAccount } from '@/lib/auth';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, LinkRow } from '@/components/ui';
import { currencySymbol } from '@/lib/money';
import { toast } from '@/components/Toast';
import type { AccountPage } from '../account/[page]';

const NOT_ADDED = 'Not added';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const settings = useSettings();
  const pricingPresets = usePricingPresets();
  const renewals = useRenewals();
  const region = useRegion();
  const isUS = region.country === 'US';
  const { isPro } = useProAccess();
  const account = useAccount();
  const loadSampleData = useTradeStore((s) => s.loadSampleData);
  const clearAllData = useTradeStore((s) => s.clearAllData);
  const [confirmClear, setConfirmClear] = useState(false);

  const prefs = reminderPrefs(settings);
  const remindersOn = Object.values(prefs).filter(Boolean).length;
  const nextRenewal = [...renewals].sort((a, b) => a.expires.localeCompare(b.expires))[0];
  const renewalSoon = nextRenewal && daysUntil(nextRenewal.expires) <= 30;
  const lookLabel = { automatic: 'Automatic', light: 'Light', dark: 'Dark' }[settings.appearance ?? 'automatic'];

  const groups: { page: AccountPage; label: string; value: string; alert?: boolean }[][] = [
    [
      { page: 'business', label: 'Your business', value: settings.businessName.trim() || settings.ownerName.trim() || NOT_ADDED },
      {
        page: 'pay',
        label: 'Getting paid',
        value: settings.paymentDetails.trim() ? `Details added · ${settings.paymentTermsDays ?? 14} days` : NOT_ADDED,
      },
      {
        page: 'prices',
        label: 'Prices and tax',
        value: `${currencySymbol()}${settings.hourlyRate}/hour · ${pricingPresets.filter((p) => p.type !== 'emergency').length} job types`,
      },
      {
        page: 'insurance',
        label: 'Insurance and licences',
        value: !renewals.length
          ? NOT_ADDED
          : renewalSoon
            ? `${nextRenewal.name.split(' ')[0]} runs out in ${Math.max(0, daysUntil(nextRenewal.expires))} days`
            : `${renewals.length} added`,
        alert: !!renewalSoon,
      },
    ],
    [
      {
        page: 'diary',
        label: isUS ? 'Schedule' : 'Diary',
        value: `${settings.workingHours.start}–${settings.workingHours.end} · ${settings.serviceRadiusMiles} miles`,
      },
      {
        page: 'reminders',
        label: 'Reminders',
        value: remindersOn === 4 ? 'All on' : remindersOn === 0 ? 'Off' : `${remindersOn} of 4 on`,
      },
      { page: 'appearance', label: 'Appearance', value: lookLabel },
    ],
    [
      { page: 'plan', label: 'Plan', value: isPro ? 'Pro' : 'Free · 3 invoices a month' },
      { page: 'signin', label: 'Sign in', value: account ? account.email || account.name || 'Signed in' : 'Not signed in' },
      { page: 'help', label: 'Help and legal', value: '' },
    ],
  ];

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg"
        contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16 }}
      >
        <Text className="text-fg text-[28px] font-bold tracking-tight mb-5" accessibilityRole="header">
          Account
        </Text>

        {groups.map((rows, gi) => (
          <Group key={gi} className="mb-6">
            {rows.map((r, i) => (
              <View key={r.page}>
                {i > 0 && <RowDivider />}
                <Pressable
                  onPress={() => router.push(`/account/${r.page}`)}
                  className="flex-row items-center px-4 min-h-[56px] py-2 active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel={r.value ? `${r.label}, ${r.value}` : r.label}
                >
                  <Text className="flex-1 text-fg text-base mr-3">{r.label}</Text>
                  {!!r.value && (
                    <Text
                      className={cn('text-[15px] mr-2 max-w-[60%]', r.alert ? 'text-alert' : 'text-secondary')}
                      numberOfLines={1}
                    >
                      {r.value}
                    </Text>
                  )}
                  <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                </Pressable>
              </View>
            ))}
          </Group>
        ))}

        <Group className="mb-8">
          {__DEV__ && (
            <>
              <LinkRow
                label="Load sample data (dev only)"
                icon={Database}
                onPress={() => {
                  loadSampleData();
                  toast('Sample data loaded');
                }}
              />
              <RowDivider />
            </>
          )}
          <LinkRow label="Delete all my data" icon={Trash2} destructive onPress={() => setConfirmClear(true)} />
        </Group>

        <View className="items-center">
          <Text className="text-link text-[15px] font-extrabold tracking-[2px]">TRADIE</Text>
          <Text className="text-secondary text-[13px] mt-1">Version {Constants.expoConfig?.version}</Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmClear}
        title="Delete all your data?"
        message="Every job, customer, invoice and expense on this phone will be deleted. This can’t be undone. Your account and any Pro subscription aren’t affected."
        confirmText="Delete everything"
        cancelText="Cancel"
        variant="error"
        onConfirm={async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await cancelAllReminders();
          clearAllData();
          toast('All data deleted');
        }}
        onCancel={() => {}}
        onDismiss={() => setConfirmClear(false)}
      />
    </>
  );
}
