import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Plus,
  Phone,
  Navigation,
  ChevronRight,
  CircleAlert,
  Mic,
  Check,
  ShieldAlert,
  Keyboard,
  Circle,
  CircleCheck,
} from 'lucide-react-native';
import {
  useTradeStore,
  useJobs,
  useInvoices,
  useSettings,
  useRenewals,
  type Job,
  getRegion,
  daysOverdue,
  daysUntil,
} from '@/lib/store';
import { renewalStatus } from '@/components/Renewals';
import { getJobTypeLabel } from '@/lib/store';
import { formatTime, toDateKey } from '@/lib/dates';
import { useTheme } from '@/lib/theme';
import { VOICE_ENABLED } from '@/lib/features';
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
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString(getRegion().locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
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
    const overdue = unpaid.filter((i) => daysOverdue(i, settings, now) > 0);
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
  }, [invoices, nowMs, settings]);

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
  // Quotes not yet accepted (sent or still to send), and accepted jobs that still need a time.
  const quotes = jobs.filter((j) => j.status === 'REQUESTED' || j.status === 'QUOTED');
  const toBook = jobs.filter((j) => j.status === 'APPROVED' && !j.scheduledDate);
  // Insurance and licences expiring within 30 days, or already expired.
  const renewals = useRenewals();
  const dueRenewals = renewals.filter((r) => daysUntil(r.expires) <= 30).sort((x, y) => x.expires.localeCompare(y.expires));
  // First-run checklist: what quotes and invoices need from the profile.
  const setupSteps = [
    {
      label: 'Business details',
      hint: 'Name, phone and address',
      done: !!(settings.businessName.trim() || settings.ownerName.trim()) && !!(settings.phone.trim() || settings.email.trim()),
    },
    { label: 'How customers pay you', hint: 'Bank or payment details for invoices', done: !!settings.paymentDetails.trim() },
    { label: 'Insurance and licences', hint: 'Optional · reminders before they expire', done: renewals.length > 0 },
  ];

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
      {/* Header: greeting first, then the main action full width */}
      <View className="mb-7">
        <Text className="text-secondary text-sm">{today}</Text>
        <Text className="text-fg text-[28px] font-bold tracking-tight" numberOfLines={1}>
          {greeting(settings.ownerName ?? '')}
        </Text>
        {jobs.length > 0 && (
          <PrimaryButton icon={Plus} label="New job" onPress={() => router.push('/add-job')} className="mt-4" />
        )}
      </View>

      {jobs.length === 0 ? (
        /* First run: a choice of what to do first, each one tappable */
        <View>
          <Group className="p-5 mb-8">
            <Text className="text-fg text-[17px] font-semibold mb-1">Add your first job</Text>
            <Text className="text-secondary text-[15px] leading-5 mb-4">
              Add the customer and the job, and Tradie works out the quote from your prices.
            </Text>
            {VOICE_ENABLED ? (
              <View className="flex-row gap-3">
                <PrimaryButton
                  icon={Keyboard}
                  label="Type it in"
                  onPress={() => router.push('/add-job?mode=type')}
                  className="flex-1"
                />
                <SecondaryButton
                  icon={Mic}
                  label="Say it"
                  onPress={() => router.push('/add-job?mode=voice')}
                  className="flex-1"
                />
              </View>
            ) : (
              <PrimaryButton icon={Plus} label="Add a job" onPress={() => router.push('/add-job')} />
            )}
          </Group>

          <SectionHeader title="Set up your business" />
          <Group className="mb-2">
            {setupSteps.map((step, i) => (
              <View key={step.label}>
                {i > 0 && <RowDivider />}
                <Pressable
                  onPress={() => router.push('/(tabs)/settings')}
                  className="flex-row items-center px-4 min-h-[56px] py-2 active:opacity-70"
                  accessibilityRole="button"
                  accessibilityState={{ checked: step.done }}
                >
                  {step.done ? (
                    <CircleCheck size={22} color={t.link} strokeWidth={2} />
                  ) : (
                    <Circle size={22} color={t.secondary} strokeWidth={2} />
                  )}
                  <View className="flex-1 ml-3">
                    <Text className={step.done ? 'text-secondary text-base' : 'text-fg text-base'}>{step.label}</Text>
                    <Text className="text-secondary text-[13px]">{step.hint}</Text>
                  </View>
                  <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                </Pressable>
              </View>
            ))}
          </Group>
          <Text className="text-secondary text-[13px] mx-1">These go on your quotes and invoices. You can do them any time.</Text>
        </View>
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

          {/* Renewals due */}
          {dueRenewals.length > 0 && (
            <View className="mb-8">
              <SectionHeader title="Renewals" />
              <Group>
                {dueRenewals.map((r, i) => (
                  <View key={r.id}>
                    {i > 0 && <RowDivider />}
                    <Pressable
                      onPress={() => router.push('/(tabs)/settings')}
                      className="flex-row items-center px-4 py-3 active:opacity-70"
                      accessibilityRole="button"
                    >
                      <ShieldAlert size={20} color={t.alert} strokeWidth={2} />
                      <View className="flex-1 ml-3 mr-2">
                        <Text className="text-fg text-base font-medium" numberOfLines={1}>
                          {r.name}
                        </Text>
                        <Text className="text-alert text-sm" numberOfLines={1}>
                          {renewalStatus(r).text}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                    </Pressable>
                  </View>
                ))}
              </Group>
            </View>
          )}

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
                    <Pressable
                      onPress={directionsNext}
                      className="flex-row items-center min-h-[48px] mr-6"
                      accessibilityRole="button"
                    >
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
                <SecondaryButton
                  compact
                  className="self-start mt-3"
                  label="Open calendar"
                  onPress={() => router.push('/(tabs)/calendar')}
                />
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
                        <Text className="text-fg text-base" numberOfLines={1}>
                          {label(job)}
                        </Text>
                        <Text className="text-secondary text-sm" numberOfLines={1}>
                          {customerName(job)}
                        </Text>
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
            <View className="mb-8">
              <SectionHeader title="Quotes waiting" />
              <Group>
                {quotes.map((job, i) => {
                  const sent = job.status === 'QUOTED' && !!job.quoteSentAt;
                  const expired = sent && !!job.quote?.validUntil && new Date(job.quote.validUntil) < new Date();
                  return (
                    <JobRow
                      key={job.id}
                      first={i === 0}
                      title={label(job)}
                      detail={`${customerName(job)} · ${expired ? 'expired' : sent ? `sent ${daysAgo(job.quoteSentAt!)}` : 'not sent yet'}`}
                      alert={expired}
                      amount={job.quote ? money(job.quote.total) : undefined}
                      onPress={() => router.push(`/job/${job.id}`)}
                    />
                  );
                })}
              </Group>
            </View>
          )}

          {/* Accepted, not booked yet */}
          {toBook.length > 0 && (
            <View className="mb-8">
              <SectionHeader title="To book" />
              <Group>
                {toBook.map((job, i) => (
                  <JobRow
                    key={job.id}
                    first={i === 0}
                    title={label(job)}
                    detail={`${customerName(job)} · ${job.offeredSlots?.length ? 'times offered' : 'quote accepted'}`}
                    amount={job.quote ? money(job.quote.total) : undefined}
                    onPress={() => router.push(`/job/${job.id}`)}
                  />
                ))}
              </Group>
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

function JobRow({
  first,
  title,
  detail,
  alert,
  amount,
  onPress,
}: {
  first: boolean;
  title: string;
  detail: string;
  alert?: boolean;
  amount?: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <View>
      {!first && <RowDivider />}
      <Pressable onPress={onPress} className="flex-row items-center px-4 py-3 active:opacity-70" accessibilityRole="button">
        <View className="flex-1 mr-3">
          <Text className="text-fg text-base font-medium" numberOfLines={1}>
            {title}
          </Text>
          <Text className={alert ? 'text-alert text-sm' : 'text-secondary text-sm'} numberOfLines={1}>
            {detail}
          </Text>
        </View>
        {amount && <Text className="text-fg text-base font-semibold mr-2">{amount}</Text>}
        <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
      </Pressable>
    </View>
  );
}
