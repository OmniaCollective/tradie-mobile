import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Phone, Navigation, ChevronRight, CircleAlert, Mic, Check } from 'lucide-react-native';
import { useTradeStore, useJobs, useInvoices, useSettings, type Job, getRegion } from '@/lib/store';
import { getJobTypeLabel } from '@/lib/store';
import { formatTime, toDateKey } from '@/lib/dates';
import { useTheme } from '@/lib/theme';
import { formatMoney } from '@/lib/money';
import { Group, RowDivider, SectionHeader, PrimaryButton, SecondaryButton } from '@/components/ui';

const DAY_MS = 24 * 60 * 60 * 1000;

const money = formatMoney;

function greeting(name: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const first = name.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : `Good ${part.toLowerCase()}`;
}

function dayLabel(dateStr: string | undefined, todayStr: string): string {
  if (!dateStr) return '';
  if (dateStr === todayStr) return 'Today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === toDateKey(tomorrow)) return 'Tomorrow';
  // Parse the stored local date as local noon so it can't slip a day in any timezone.
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(getRegion().locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

function daysAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const jobs = useJobs();
  const invoices = useInvoices();
  const settings = useSettings();
  const getCustomer = useTradeStore((s) => s.getCustomer);
  const updateJob = useTradeStore((s) => s.updateJob);

  // Read the clock once per visit; the figures don't need to tick while open.
  const [nowMs] = useState(() => Date.now());
  const todayStr = toDateKey(new Date(nowMs));

  const money_ = useMemo(() => {
    const now = new Date(nowMs);
    const unpaid = invoices.filter((i) => i.status !== 'paid');
    const overdue = unpaid.filter(
      (i) => i.sentAt && nowMs - new Date(i.sentAt).getTime() > (settings.paymentTermsDays ?? 14) * DAY_MS,
    );
    const paidThisMonth = invoices.filter((i) => {
      if (i.status !== 'paid' || !i.paidAt) return false;
      const d = new Date(i.paidAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return {
      unpaidTotal: unpaid.reduce((sum, i) => sum + i.quote.total, 0),
      overdueCount: overdue.length,
      paidTotal: paidThisMonth.reduce((sum, i) => sum + i.quote.total, 0),
      paidCount: paidThisMonth.length,
    };
  }, [invoices, nowMs, settings.paymentTermsDays]);

  const inProgress = jobs.find((j) => j.status === 'IN_PROGRESS');
  const upcoming = useMemo(
    () =>
      jobs
        .filter((j) => j.status === 'SCHEDULED' && j.scheduledDate && j.scheduledDate >= todayStr)
        .sort((a, b) =>
          `${a.scheduledDate}T${a.scheduledTime || '00:00'}`.localeCompare(`${b.scheduledDate}T${b.scheduledTime || '00:00'}`),
        ),
    [jobs, todayStr],
  );
  const nextUp: Job | undefined = inProgress ?? upcoming[0];
  const comingUp = upcoming.filter((j) => j.id !== nextUp?.id).slice(0, 3);
  const quotes = jobs.filter((j) => j.status === 'QUOTED');

  const label = (job: Job) => getJobTypeLabel(settings.trade, job.type);
  const customerName = (job: Job) => getCustomer(job.customerId)?.name ?? 'Unknown customer';

  const nextCustomer = nextUp ? getCustomer(nextUp.customerId) : undefined;
  const callNext = () => nextCustomer?.phone && Linking.openURL(`tel:${nextCustomer.phone}`);
  const directionsNext = () => {
    if (!nextCustomer) return;
    const address = encodeURIComponent(`${nextCustomer.address}, ${nextCustomer.postcode}`);
    Linking.openURL(`https://maps.apple.com/?daddr=${address}`);
  };

  const today = new Date().toLocaleDateString(getRegion().locale, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16 }}
    >
      {/* Header */}
      <View className="flex-row items-end justify-between mb-7">
        <View className="flex-1 mr-3">
          <Text className="text-secondary text-sm">{today}</Text>
          <Text className="text-fg text-[28px] font-bold tracking-tight" numberOfLines={1}>
            {greeting(settings.ownerName ?? '')}
          </Text>
        </View>
        <PrimaryButton compact icon={Plus} label="New job" onPress={() => router.push('/add-job')} />
      </View>

      {jobs.length === 0 ? (
        /* First run: one clear next step */
        <Group className="p-5">
          <Text className="text-fg text-[17px] font-semibold mb-1">Add your first job</Text>
          <Text className="text-secondary text-[15px] leading-5 mb-4">
            Type it in or just say it — “Leaking tap for Sarah Jones, Friday at 9”.
          </Text>
          <View className="flex-row items-center">
            <Mic size={16} color={t.link} strokeWidth={2} />
            <Text className="text-link text-sm font-semibold ml-1.5">Tap New job, then the microphone</Text>
          </View>
        </Group>
      ) : (
        <>
          {/* Money */}
          <Pressable onPress={() => router.push('/(tabs)/finances')} accessibilityRole="button">
            <Group className="flex-row mb-8">
              <View className="flex-1 px-4 py-3.5">
                <Text className="text-secondary text-[13px]">Unpaid</Text>
                <Text className="text-fg text-[22px] font-bold tracking-tight mt-1">{money(money_.unpaidTotal)}</Text>
                {money_.overdueCount > 0 ? (
                  <View className="flex-row items-center mt-1">
                    <CircleAlert size={14} color={t.alert} strokeWidth={2} />
                    <Text className="text-alert text-xs ml-1">{money_.overdueCount} overdue</Text>
                  </View>
                ) : (
                  <Text className="text-secondary text-xs mt-1">Nothing overdue</Text>
                )}
              </View>
              <View className="w-px bg-divider" />
              <View className="flex-1 px-4 py-3.5">
                <Text className="text-secondary text-[13px]">Paid this month</Text>
                <Text className="text-fg text-[22px] font-bold tracking-tight mt-1">{money(money_.paidTotal)}</Text>
                <Text className="text-secondary text-xs mt-1">
                  {money_.paidCount} {money_.paidCount === 1 ? 'invoice' : 'invoices'}
                </Text>
              </View>
            </Group>
          </Pressable>

          {/* Next up */}
          <View className="mb-8">
            <SectionHeader title={inProgress ? 'On now' : 'Next up'} />
            {nextUp ? (
              <Group className="px-4 pt-4">
                <Pressable onPress={() => router.push(`/job/${nextUp.id}`)} accessibilityRole="button">
                  <View className="flex-row items-baseline justify-between mb-2.5">
                    <Text className="text-link text-sm font-semibold">
                      {inProgress
                        ? 'In progress'
                        : `${dayLabel(nextUp.scheduledDate, todayStr)} · ${formatTime(nextUp.scheduledTime)}`}
                    </Text>
                    {nextUp.quote && <Text className="text-secondary text-sm">{money(nextUp.quote.total)}</Text>}
                  </View>
                  <Text className="text-fg text-[17px] font-semibold">{label(nextUp)}</Text>
                  <Text className="text-secondary text-[15px] mt-0.5" numberOfLines={1}>
                    {customerName(nextUp)}
                    {nextCustomer?.address ? ` · ${nextCustomer.address}` : ''}
                  </Text>
                </Pressable>
                <View className="flex-row border-t border-divider mt-3.5">
                  {nextCustomer?.phone ? (
                    <Pressable onPress={callNext} className="flex-row items-center min-h-[48px] mr-6" accessibilityRole="button">
                      <Phone size={20} color={t.link} strokeWidth={2} />
                      <Text className="text-link text-[15px] font-semibold ml-1.5">Call</Text>
                    </Pressable>
                  ) : null}
                  {nextCustomer?.address ? (
                    <Pressable onPress={directionsNext} className="flex-row items-center min-h-[48px] mr-6" accessibilityRole="button">
                      <Navigation size={20} color={t.link} strokeWidth={2} />
                      <Text className="text-link text-[15px] font-semibold ml-1.5">Directions</Text>
                    </Pressable>
                  ) : null}
                  {inProgress && (
                    <Pressable
                      onPress={() => updateJob(inProgress.id, { status: 'COMPLETED', completedAt: new Date().toISOString() })}
                      className="flex-row items-center min-h-[48px] ml-auto"
                      accessibilityRole="button"
                    >
                      <Check size={20} color={t.link} strokeWidth={2} />
                      <Text className="text-link text-[15px] font-semibold ml-1.5">Mark done</Text>
                    </Pressable>
                  )}
                </View>
              </Group>
            ) : (
              <Group className="p-4">
                <Text className="text-secondary text-[15px]">Nothing booked yet.</Text>
                <SecondaryButton compact className="self-start mt-3" label="Open calendar" onPress={() => router.push('/(tabs)/calendar')} />
              </Group>
            )}
          </View>

          {/* Coming up */}
          {comingUp.length > 0 && (
            <View className="mb-8">
              <SectionHeader title="Coming up" actionLabel="See all" onAction={() => router.push('/(tabs)/calendar')} />
              <Group>
                {comingUp.map((job, i) => (
                  <View key={job.id}>
                    {i > 0 && <RowDivider />}
                    <Pressable
                      onPress={() => router.push(`/job/${job.id}`)}
                      className="flex-row items-center px-4 py-3 active:opacity-70"
                      accessibilityRole="button"
                    >
                      <View className="w-[88px]">
                        <Text className="text-fg text-sm font-semibold">{dayLabel(job.scheduledDate, todayStr)}</Text>
                        <Text className="text-secondary text-[13px]">{formatTime(job.scheduledTime)}</Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-fg text-base" numberOfLines={1}>{label(job)}</Text>
                        <Text className="text-secondary text-sm" numberOfLines={1}>{customerName(job)}</Text>
                      </View>
                      <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                    </Pressable>
                  </View>
                ))}
              </Group>
            </View>
          )}

          {/* Quotes waiting */}
          {quotes.length > 0 && (
            <View>
              <SectionHeader title="Quotes waiting" />
              <Group>
                {quotes.map((job, i) => {
                  const expired = !!job.quote?.validUntil && new Date(job.quote.validUntil) < new Date();
                  return (
                    <View key={job.id}>
                      {i > 0 && <RowDivider />}
                      <Pressable
                        onPress={() => router.push(`/job/${job.id}`)}
                        className="flex-row items-center px-4 py-3 active:opacity-70"
                        accessibilityRole="button"
                      >
                        <View className="flex-1 mr-3">
                          <Text className="text-fg text-base font-medium" numberOfLines={1}>{label(job)}</Text>
                          <Text className={expired ? 'text-alert text-sm' : 'text-secondary text-sm'} numberOfLines={1}>
                            {customerName(job)}
                            {job.quote ? ` · ${expired ? 'expired' : `sent ${daysAgo(job.quote.createdAt)}`}` : ''}
                          </Text>
                        </View>
                        {job.quote && <Text className="text-fg text-base font-semibold mr-2">{money(job.quote.total)}</Text>}
                        <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                      </Pressable>
                    </View>
                  );
                })}
              </Group>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
