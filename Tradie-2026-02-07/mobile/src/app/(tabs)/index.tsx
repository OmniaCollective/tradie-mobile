/**
 * Home answers "what needs me?": jobs grouped by where they are (lib/jobSteps.ts), with
 * Remind on quiet quotes and Chase on overdue invoices. Dates and money live in Diary and
 * Money. Agreed design: release/ux-journey-review.md.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, ChevronRight, ChevronDown, ShieldAlert, Circle, CircleCheck, Search } from 'lucide-react-native';
import {
  useJobs,
  useInvoices,
  useSettings,
  useRenewals,
  useCustomers,
  type Job,
  getRegion,
  daysUntil,
  jobName,
} from '@/lib/store';
import { jobPosition, GROUP_ORDER, GROUP_TITLES, type JobGroup } from '@/lib/jobSteps';
import { renewalStatus } from '@/components/Renewals';
import { whereText } from '@/lib/jobText';
import { useTheme } from '@/lib/theme';
import { formatAmount } from '@/lib/money';
import { chaseInvoice, remindAboutQuote } from '@/lib/chase';
import { Group, RowDivider, SectionHeader, PrimaryButton } from '@/components/ui';
import { Tip } from '@/components/Tip';
import { toast } from '@/components/Toast';

function greeting(name: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const first = name.trim().split(/\s+/)[0];
  return first ? `${part}, ${first}` : `Good ${part.toLowerCase()}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const jobs = useJobs();
  const invoices = useInvoices();
  const customers = useCustomers();
  const settings = useSettings();
  const renewals = useRenewals();
  const [showLost, setShowLost] = useState(false);

  // Read the clock once per visit; the lists don't need to tick while open.
  const [nowMs] = useState(() => Date.now());
  const now = useMemo(() => new Date(nowMs), [nowMs]);
  const terms = settings.paymentTermsDays ?? 14;

  const rows = useMemo(() => {
    const invoiceFor = new Map(invoices.map((inv) => [inv.jobId, inv]));
    const byId = new Map(customers.map((c) => [c.id, c]));
    return jobs.map((job) => {
      const invoice = invoiceFor.get(job.id);
      const customer = byId.get(job.customerId);
      const p = jobPosition(job, invoice, terms, now);
      const first = customer?.name.trim().split(/\s+/)[0] || 'the customer';
      return { job, invoice, customer, p, text: whereText(job, invoice, p, first, terms, now) };
    });
  }, [jobs, invoices, customers, terms, now]);
  type Row = (typeof rows)[number];

  const groups = useMemo(() => {
    const thisMonth = (iso?: string) => {
      if (!iso) return false;
      const d = new Date(iso);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    const sorted = Object.fromEntries(GROUP_ORDER.map((g) => [g, [] as Row[]])) as Record<JobGroup, Row[]>;
    for (const r of rows) {
      // Paid: only this month's, so Home stays about what's live.
      if (r.p.group === 'paid' && !thisMonth(r.invoice?.paidAt)) continue;
      sorted[r.p.group].push(r);
    }
    const when = (r: Row) => `${r.job.scheduledDate ?? ''}T${r.job.scheduledTime ?? ''}`;
    sorted.booked.sort((a, b) => when(a).localeCompare(when(b)));
    sorted.unpaid.sort((a, b) => b.p.overdueDays - a.p.overdueDays);
    sorted.waiting.sort((a, b) => b.p.quoteWaitingDays - a.p.quoteWaitingDays);
    return sorted;
  }, [rows, now]);

  const overdueCount = groups.unpaid.filter((r) => r.p.overdueDays > 0).length;
  const tally = [
    { label: 'To send', n: groups.send.length, alert: false },
    { label: 'Waiting', n: groups.waiting.length + groups.tobook.length, alert: false },
    { label: 'To invoice', n: groups.invoice.length, alert: false },
    overdueCount
      ? { label: 'Overdue', n: overdueCount, alert: true }
      : { label: 'Unpaid', n: groups.unpaid.length, alert: false },
  ];

  const dueRenewals = renewals.filter((r) => daysUntil(r.expires) <= 30).sort((x, y) => x.expires.localeCompare(y.expires));
  const setupSteps = [
    {
      page: 'business',
      label: 'Business details',
      hint: 'Name, phone and address',
      done: !!(settings.businessName.trim() || settings.ownerName.trim()) && !!(settings.phone.trim() || settings.email.trim()),
    },
    {
      page: 'pay',
      label: 'How customers pay you',
      hint: 'Bank or payment details for invoices',
      done: !!settings.paymentDetails.trim(),
    },
    {
      page: 'insurance',
      label: 'Insurance and licences',
      hint: 'Optional · reminders before they expire',
      done: renewals.length > 0,
    },
  ];
  const setupLeft = setupSteps.some((s) => !s.done);
  const hasJobs = jobs.length > 0;
  const today = now.toLocaleDateString(getRegion().locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const label = (job: Job) => jobName(job, settings.trade);

  const nudge = async (r: Row) => {
    if (!r.customer) return;
    if (r.p.nudge === 'chase' && r.invoice) {
      if (await chaseInvoice(r.invoice, r.job, r.customer, settings)) toast('Reminder sent');
    } else if (await remindAboutQuote(r.job, r.customer, label(r.job), settings)) {
      toast('Reminder sent');
    }
  };

  const jobList = (g: JobGroup, items: Row[]) => (
    <Group>
      {items.map((r, i) => {
        const amount = (r.invoice?.quote ?? r.job.quote)?.total;
        return (
          <View key={r.job.id}>
            {i > 0 && <RowDivider />}
            <View className="flex-row items-center">
              <Pressable
                onPress={() => router.push(`/job/${r.job.id}`)}
                className="flex-1 flex-row items-center pl-4 pr-2 py-3 min-h-[62px] active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel={`${label(r.job)}, ${r.customer?.name ?? ''}, ${r.text}${amount !== undefined ? ', ' + formatAmount(amount) : ''}`}
              >
                <View className="flex-1 mr-3">
                  <Text className="text-fg text-base font-medium" numberOfLines={1}>
                    {label(r.job)}
                  </Text>
                  <Text className={r.p.overdueDays > 0 ? 'text-alert text-sm' : 'text-secondary text-sm'} numberOfLines={1}>
                    {r.customer?.name ?? 'Unknown customer'} · {r.text}
                  </Text>
                </View>
                {amount !== undefined && (
                  <Text className={g === 'paid' ? 'text-link text-base font-semibold' : 'text-fg text-base font-semibold'}>
                    {formatAmount(amount)}
                  </Text>
                )}
              </Pressable>
              {r.p.nudge ? (
                <Pressable
                  onPress={() => nudge(r)}
                  className="bg-bg rounded-xl h-9 px-3 mr-3 items-center justify-center active:opacity-70"
                  accessibilityRole="button"
                  accessibilityLabel={`${r.p.nudge === 'chase' ? 'Chase' : 'Remind'} ${r.customer?.name ?? ''}`}
                >
                  <Text className="text-link text-[15px] font-semibold">{r.p.nudge === 'chase' ? 'Chase' : 'Remind'}</Text>
                </Pressable>
              ) : (
                <View className="mr-4">
                  <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                </View>
              )}
            </View>
          </View>
        );
      })}
    </Group>
  );

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 32, paddingHorizontal: 16 }}
    >
      <View className="mb-6">
        <Text className="text-secondary text-sm">{today}</Text>
        <View className="flex-row items-center justify-between">
          <Text className="flex-1 text-fg text-[28px] font-bold tracking-tight mr-3" numberOfLines={1} accessibilityRole="header">
            {greeting(settings.ownerName ?? '')}
          </Text>
          {hasJobs && (
            <Pressable
              onPress={() => router.push('/search')}
              className="w-11 h-11 rounded-full bg-surface items-center justify-center active:opacity-70"
              accessibilityRole="button"
              accessibilityLabel="Search customers, jobs and invoices"
            >
              <Search size={20} color={t.fg} strokeWidth={2} />
            </Pressable>
          )}
        </View>
        {hasJobs && <PrimaryButton icon={Plus} label="New job" onPress={() => router.push('/add-job')} className="mt-4" />}
      </View>

      <Tip id="home" text="Start here: add a job, send the quote, and Tradie tracks it to paid." className="mb-6" />

      {!hasJobs ? (
        <Group className="p-5 mb-8">
          <Text className="text-fg text-[17px] font-semibold mb-1">Add your first job</Text>
          <Text className="text-secondary text-[15px] leading-5 mb-4">
            Add the customer and the job, and Tradie works out the quote from your prices.
          </Text>
          <PrimaryButton icon={Plus} label="Add a job" onPress={() => router.push('/add-job')} />
        </Group>
      ) : (
        <>
          {/* Where things stand */}
          <Group className="flex-row mb-8 py-3">
            {tally.map((x) => (
              <View key={x.label} className="flex-1 items-center" accessible accessibilityLabel={`${x.n} ${x.label}`}>
                <Text className={x.alert ? 'text-alert text-[22px] font-bold' : 'text-fg text-[22px] font-bold'}>{x.n}</Text>
                <Text className="text-secondary text-xs">{x.label}</Text>
              </View>
            ))}
          </Group>

          {dueRenewals.length > 0 && (
            <View className="mb-8">
              <SectionHeader title="Renewals" />
              <Group>
                {dueRenewals.map((r, i) => (
                  <View key={r.id}>
                    {i > 0 && <RowDivider />}
                    <Pressable
                      onPress={() => router.push('/account/insurance')}
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

          {GROUP_ORDER.filter((g) => g !== 'lost' && groups[g].length > 0).map((g) => (
            <View key={g} className="mb-8">
              <View className="flex-row justify-between items-baseline mx-1 mb-2">
                <Text className="text-fg text-[17px] font-semibold" accessibilityRole="header">
                  {g === 'paid' ? 'Paid this month' : GROUP_TITLES[g]}
                </Text>
                <Text className="text-secondary text-sm">{groups[g].length}</Text>
              </View>
              {jobList(g, groups[g])}
            </View>
          ))}

          {groups.lost.length > 0 && (
            <View className="mb-8">
              <Pressable
                onPress={() => setShowLost((v) => !v)}
                className="flex-row items-center justify-between mx-1 mb-2 min-h-[44px]"
                accessibilityRole="button"
                accessibilityState={{ expanded: showLost }}
              >
                <Text className="text-secondary text-[15px]">
                  {groups.lost.length} {groups.lost.length === 1 ? 'job' : 'jobs'} didn’t go ahead
                </Text>
                <ChevronDown
                  size={16}
                  color={t.secondary}
                  strokeWidth={2}
                  style={{ transform: [{ rotate: showLost ? '180deg' : '0deg' }] }}
                />
              </Pressable>
              {showLost && jobList('lost', groups.lost)}
            </View>
          )}
        </>
      )}

      {/* Set-up list (option A): under the first-job card, and under the jobs until it's done */}
      {setupLeft && (
        <>
          <SectionHeader title="Set up your business" />
          <Group className="mb-2">
            {setupSteps.map((step, i) => (
              <View key={step.label}>
                {i > 0 && <RowDivider />}
                <Pressable
                  onPress={() => router.push(`/account/${step.page}`)}
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
        </>
      )}
    </ScrollView>
  );
}
