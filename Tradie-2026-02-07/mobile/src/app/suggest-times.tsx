import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Share, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Circle, CircleCheck, Plus, Route, Car, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as SMS from 'expo-sms';
import { useTradeStore, getJobTypeLabel, jobName } from '@/lib/store';
import { buildSuggestions, formatSlot, offerMessage, toSlot, type SuggestResult, type TravelNote } from '@/lib/booking';
import type { Suggestion } from '@/lib/scheduling';
import { useAccount } from '@/lib/auth';
import { useBusinessDetailsPrompt } from '@/components/BusinessDetailsPrompt';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, SectionHeader, PrimaryButton, FieldRow, Sheet, ModalHeader } from '@/components/ui';
import { AppleSignInButton } from '@/components/AppleSignInButton';

const MAX_TIMES = 3;

const TRAVEL_NOTE: Record<TravelNote, string> = {
  apple: 'Drive times from Apple Maps.',
  estimate: 'Drive times are estimates from distance.',
  'signed-out': 'Sign in to include real drive times.',
  'no-postcode': 'Add the customer’s postcode to include drive times.',
  'postcode-not-found': 'We couldn’t find that postcode, so drive times are left out.',
  offline: 'You’re offline, so drive times are left out.',
};

export default function SuggestTimesScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  // Opened from a link or notification there may be nothing to go back to; then go Home.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const account = useAccount();
  const job = useTradeStore((s) => s.jobs.find((j) => j.id === jobId));
  const customer = useTradeStore((s) => (job ? s.customers.find((c) => c.id === job.customerId) : undefined));
  const trade = useTradeStore((s) => s.settings.trade);
  const updateJob = useTradeStore((s) => s.updateJob);
  const updateCustomer = useTradeStore((s) => s.updateCustomer);
  const { requireDetails, prompt: detailsPrompt } = useBusinessDetailsPrompt();

  // Recalculates when the customer's postcode changes or the person signs in.
  const query = useQuery({
    queryKey: ['suggest-times', jobId, customer?.postcode, account?.userId],
    queryFn: () => buildSuggestions(jobId!),
    enabled: !!jobId,
    gcTime: 0,
    retry: false,
  });
  const result: SuggestResult | undefined = query.data;
  const error = query.isError;
  const load = () => query.refetch();
  // The person's own picks, tied to the result they were made from.
  const [pick, setPick] = useState<{ from: SuggestResult; list: Suggestion[] } | null>(null);
  const chosen = useMemo(() => (result ? (pick?.from === result ? pick.list : result.suggestions) : []), [result, pick]);
  const setChosen = (update: (cur: Suggestion[]) => Suggestion[]) => result && setPick({ from: result, list: update(chosen) });
  const [showMore, setShowMore] = useState(false);
  const [postcode, setPostcode] = useState('');
  const [sending, setSending] = useState(false);

  const times = useMemo(() => [...chosen].sort((a, b) => a.start.getTime() - b.start.getTime()), [chosen]);
  const label = job ? jobName(job, trade) : '';
  const message = customer && times.length ? offerMessage(customer, label, times.map((s) => s.start)) : '';

  if (!job || !customer) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-secondary text-base text-center">This job no longer exists.</Text>
      </View>
    );
  }

  const isChosen = (s: Suggestion) => chosen.some((c) => c.start.getTime() === s.start.getTime());
  const toggle = (s: Suggestion) => {
    Haptics.selectionAsync();
    setChosen((cur) =>
      isChosen(s) ? cur.filter((c) => c.start.getTime() !== s.start.getTime()) : cur.length < MAX_TIMES ? [...cur, s] : cur,
    );
  };

  const saveOffer = () => {
    updateJob(job.id, { offeredSlots: times.map((s) => toSlot(s.start)), offeredAt: new Date().toISOString() });
  };

  // The text is signed with the tradie's name, so ask for it first if it's missing.
  const send = () => {
    if (times.length) requireDetails('message', () => sendTimes());
  };

  const sendTimes = async () => {
    // Built now rather than at render, so a name added a moment ago is in it.
    const text = offerMessage(customer, label, times.map((s) => s.start));
    setSending(true);
    try {
      if (customer.phone && Platform.OS !== 'web' && (await SMS.isAvailableAsync())) {
        const { result: r } = await SMS.sendSMSAsync([customer.phone], text);
        if (r === 'cancelled') return;
      } else {
        const r = await Share.share({ message: text });
        if (r.action === Share.dismissedAction) return;
      }
      saveOffer();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBack();
    } catch (e) {
      if (__DEV__) console.error('Send times failed:', e);
    } finally {
      setSending(false);
    }
  };

  const shown = result?.alternatives.filter((s) => !isChosen(s)) ?? [];
  const area = customer.postcode?.trim().toUpperCase().split(/\s+/)[0];

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <ModalHeader title="Suggest times" onClose={() => goBack()} />

      <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View className="mb-6 mx-1">
          <Text className="text-fg text-[22px] font-bold tracking-tight">{customer.name}</Text>
          <Text className="text-secondary text-[15px] mt-0.5">
            {label}
            {result ? ` · about ${result.durationMinutes >= 60 ? `${result.durationMinutes / 60} hr` : `${result.durationMinutes} min`}` : ''}
            {area ? ` · ${area}` : ''}
          </Text>
        </View>

        {!customer.postcode?.trim() && (
          <Group className="mb-6">
            <FieldRow
              label="Customer’s postcode"
              hint="So the drive is counted"
              value={postcode}
              onChangeText={setPostcode}
              placeholder="SE1 7TP"
              autoCapitalize="characters"
              width="w-28"
            />
            {postcode.trim().length >= 5 && (
              <>
                <RowDivider />
                <Pressable
                  onPress={() => updateCustomer(customer.id, { postcode: postcode.trim().toUpperCase() })}
                  className="px-4 min-h-[48px] justify-center"
                  accessibilityRole="button"
                >
                  <Text className="text-link text-base font-semibold">Use this postcode</Text>
                </Pressable>
              </>
            )}
          </Group>
        )}

        <SectionHeader title="Best times" />
        {error ? (
          <Group className="p-4">
            <Text className="text-secondary text-[15px] mb-2">Couldn’t work out times just now.</Text>
            <Pressable onPress={load} accessibilityRole="button">
              <Text className="text-link text-[15px] font-semibold">Try again</Text>
            </Pressable>
          </Group>
        ) : !result ? (
          <Group className="p-6 items-center">
            <ActivityIndicator color={t.link} />
            <Text className="text-secondary text-sm mt-2">Checking your diary and drive times…</Text>
          </Group>
        ) : result.suggestions.length === 0 ? (
          <Group className="p-4">
            <Text className="text-fg text-base font-semibold mb-1">No free times in the next 4 weeks</Text>
            <Text className="text-secondary text-[15px] leading-5">
              Your diary is full for a job this long. Check your working days and hours in Account, or pick a time yourself.
            </Text>
          </Group>
        ) : (
          <Group>
            {times.map((s, i) => (
              <View key={s.start.toISOString()}>
                {i > 0 && <RowDivider />}
                <Pressable onPress={() => toggle(s)} className="flex-row items-center px-4 py-3 active:opacity-70" accessibilityRole="checkbox" accessibilityState={{ checked: true }}>
                  <CircleCheck size={22} color={t.link} strokeWidth={2} />
                  <View className="flex-1 ml-3">
                    <Text className="text-fg text-base font-semibold">{formatSlot(s.start)}</Text>
                    <View className="flex-row items-center mt-0.5">
                      {s.fitsRoute ? <Route size={14} color={t.link} strokeWidth={2} /> : <Car size={14} color={t.secondary} strokeWidth={2} />}
                      <Text className={cn('text-sm ml-1 flex-1', s.fitsRoute ? 'text-link' : 'text-secondary')} numberOfLines={1}>
                        {s.fitsRoute ? `Fits your route · ${s.reason}` : s.reason}
                      </Text>
                    </View>
                  </View>
                  <X size={16} color={t.secondary} strokeWidth={2} />
                </Pressable>
              </View>
            ))}
            {times.length < MAX_TIMES && shown.length > 0 && (
              <>
                {times.length > 0 && <RowDivider />}
                <Pressable onPress={() => setShowMore(true)} className="flex-row items-center px-4 min-h-[52px] active:opacity-70" accessibilityRole="button">
                  <Plus size={20} color={t.link} strokeWidth={2} />
                  <Text className="text-link text-base font-semibold ml-2">Add another time</Text>
                </Pressable>
              </>
            )}
          </Group>
        )}
        {result && (
          <Text className="text-secondary text-[13px] mx-1 mt-2">
            {TRAVEL_NOTE[result.travel]} Times only suggest — nothing is booked until you confirm.
          </Text>
        )}
        {result?.travel === 'signed-out' && (
          <View className="mt-3">
            <AppleSignInButton label="signIn" />
          </View>
        )}

        {times.length > 0 && (
          <View className="mt-8">
            <SectionHeader title="Text to send" />
            <Group className="p-4">
              <Text className="text-fg text-[15px] leading-6">{message}</Text>
            </Group>
            {!customer.phone && (
              <Text className="text-secondary text-[13px] mx-1 mt-2">No phone number saved, so you’ll choose how to send it.</Text>
            )}
          </View>
        )}
      </ScrollView>

      {times.length > 0 && (
        <View className="absolute left-0 right-0 bottom-0 bg-bg border-t border-divider px-4 pt-3" style={{ paddingBottom: insets.bottom + 12 }}>
          <PrimaryButton
            label={customer.phone ? `Text ${times.length === 1 ? 'this time' : `these ${times.length} times`}` : 'Send times'}
            onPress={send}
            loading={sending}
          />
        </View>
      )}

      {/* More times */}
      <Sheet visible={showMore} onClose={() => setShowMore(false)}>
        <Text className="text-fg text-[17px] font-semibold text-center mb-3">More times</Text>
        <ScrollView style={{ maxHeight: 420 }} className="bg-bg rounded-2xl">
          {shown.slice(0, 20).map((s, i) => (
            <View key={s.start.toISOString()}>
              {i > 0 && <RowDivider />}
              <Pressable
                onPress={() => {
                  toggle(s);
                  setShowMore(false);
                }}
                className="flex-row items-center px-4 py-3 active:opacity-70"
                accessibilityRole="button"
              >
                <Circle size={20} color={t.secondary} strokeWidth={2} />
                <View className="flex-1 ml-3">
                  <Text className="text-fg text-base">{formatSlot(s.start)}</Text>
                  <Text className={cn('text-[13px]', s.fitsRoute ? 'text-link' : 'text-secondary')} numberOfLines={1}>
                    {s.fitsRoute ? `Fits your route · ${s.reason}` : s.reason}
                  </Text>
                </View>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </Sheet>
      {detailsPrompt}
    </View>
  );
}
