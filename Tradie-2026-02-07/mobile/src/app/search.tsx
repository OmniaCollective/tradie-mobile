/**
 * Search customers, jobs and invoices by whatever you remember (lib/search.ts). Opens from the
 * magnifier on Home and Money; closes with the X.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search as SearchIcon, ChevronRight } from 'lucide-react-native';
import {
  useCustomers,
  useJobs,
  useInvoices,
  useSettings,
  jobName,
  invoiceNumberLabel,
  type Job,
  type Invoice,
} from '@/lib/store';
import { search, recentCustomers } from '@/lib/search';
import { jobPosition } from '@/lib/jobSteps';
import { whereText } from '@/lib/jobText';
import { formatAmount } from '@/lib/money';
import { formatDate } from '@/lib/dates';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, SectionHeader, CloseButton } from '@/components/ui';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const customers = useCustomers();
  const jobs = useJobs();
  const invoices = useInvoices();
  const settings = useSettings();
  const [query, setQuery] = useState('');
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const nameOf = (job: Job) => jobName(job, settings.trade);
  const result = useMemo(
    () => search(query, { customers, jobs, invoices, nameOf: (j) => jobName(j, settings.trade) }),
    [query, customers, jobs, invoices, settings.trade],
  );
  const recent = useMemo(() => recentCustomers({ customers, jobs }), [customers, jobs]);
  const invoiceFor = useMemo(() => new Map(invoices.map((i) => [i.jobId, i])), [invoices]);
  const customerById = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);
  const terms = settings.paymentTermsDays ?? 14;
  const searching = !!query.trim();
  const shownCustomers = searching ? result.customers : recent;

  const owedBy = (customerId: string) =>
    invoices.filter((i) => i.customerId === customerId && i.status === 'sent').reduce((s, i) => s + i.quote.total, 0);
  const jobLine = (job: Job) => {
    const inv = invoiceFor.get(job.id);
    const c = customerById.get(job.customerId);
    const p = jobPosition(job, inv, terms);
    return { text: `${c?.name ?? ''} · ${whereText(job, inv, p, c?.name.split(' ')[0] ?? '', terms)}`, alert: p.overdueDays > 0 };
  };
  const invoiceLine = (inv: Invoice) => {
    const job = jobs.find((j) => j.id === inv.jobId);
    const state =
      inv.status === 'paid'
        ? `paid ${formatDate(inv.paidAt)}`
        : inv.status === 'sent'
          ? `sent ${formatDate(inv.sentAt)}`
          : 'not sent';
    return `${job ? nameOf(job) + ' · ' : ''}${state}`;
  };

  const nothing = searching && !result.customers.length && !result.jobs.length && !result.invoices.length;

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center px-4 pb-2" style={{ paddingTop: Platform.OS === 'ios' ? 14 : insets.top + 8 }}>
        <View className="flex-1 flex-row items-center bg-surface rounded-xl px-3 min-h-[48px] mr-3">
          <SearchIcon size={18} color={t.secondary} strokeWidth={2} />
          <TextInput
            className="flex-1 text-fg text-base ml-2 py-2.5"
            value={query}
            onChangeText={setQuery}
            placeholder="Name, INV number, job, postcode or amount"
            placeholderTextColor={t.secondary}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            accessibilityLabel="Search customers, jobs and invoices"
          />
        </View>
        <CloseButton onPress={close} />
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        {shownCustomers.length > 0 && (
          <View className="mb-7">
            <SectionHeader title={searching ? 'Customers' : 'Recent customers'} />
            <Group>
              {shownCustomers.map((c, i) => {
                const n = jobs.filter((j) => j.customerId === c.id).length;
                const owed = owedBy(c.id);
                return (
                  <View key={c.id}>
                    {i > 0 && <RowDivider />}
                    <Pressable
                      onPress={() => router.push(`/customer/${c.id}`)}
                      className="flex-row items-center px-4 py-3 min-h-[60px] active:opacity-70"
                      accessibilityRole="button"
                      accessibilityLabel={`${c.name}, ${n} ${n === 1 ? 'job' : 'jobs'}${owed > 0 ? `, owes ${formatAmount(owed)}` : ''}`}
                    >
                      <View className="w-9 h-9 rounded-full bg-bg items-center justify-center mr-3">
                        <Text className="text-link text-base font-bold">{c.name.trim()[0]?.toUpperCase() ?? '?'}</Text>
                      </View>
                      <View className="flex-1 mr-2">
                        <Text className="text-fg text-base font-medium">{c.name}</Text>
                        <Text className={cn('text-[13px]', owed > 0 ? 'text-alert' : 'text-secondary')} numberOfLines={1}>
                          {n} {n === 1 ? 'job' : 'jobs'}
                          {owed > 0 ? ` · owes ${formatAmount(owed)}` : c.postcode ? ` · ${c.postcode}` : ''}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                    </Pressable>
                  </View>
                );
              })}
            </Group>
          </View>
        )}

        {searching && result.jobs.length > 0 && (
          <View className="mb-7">
            <SectionHeader title="Jobs" />
            <Group>
              {result.jobs.map((job, i) => {
                const line = jobLine(job);
                const total = invoiceFor.get(job.id)?.quote.total ?? job.quote?.total;
                return (
                  <View key={job.id}>
                    {i > 0 && <RowDivider />}
                    <Pressable
                      onPress={() => router.push(`/job/${job.id}`)}
                      className="flex-row items-center px-4 py-3 min-h-[60px] active:opacity-70"
                      accessibilityRole="button"
                    >
                      <View className="flex-1 mr-3">
                        <Text className="text-fg text-base font-medium" numberOfLines={1}>
                          {nameOf(job)}
                        </Text>
                        <Text className={cn('text-[13px]', line.alert ? 'text-alert' : 'text-secondary')} numberOfLines={1}>
                          {line.text}
                        </Text>
                      </View>
                      {total !== undefined && <Text className="text-fg text-base font-semibold">{formatAmount(total)}</Text>}
                    </Pressable>
                  </View>
                );
              })}
            </Group>
          </View>
        )}

        {searching && result.invoices.length > 0 && (
          <View className="mb-7">
            <SectionHeader title="Invoices" />
            <Group>
              {result.invoices.map((inv, i) => (
                <View key={inv.id}>
                  {i > 0 && <RowDivider />}
                  <Pressable
                    onPress={() => router.push(`/job/${inv.jobId}`)}
                    className="flex-row items-center px-4 py-3 min-h-[60px] active:opacity-70"
                    accessibilityRole="button"
                  >
                    <View className="flex-1 mr-3">
                      <Text className="text-fg text-base font-medium" numberOfLines={1}>
                        {invoiceNumberLabel(inv)} · {customerById.get(inv.customerId)?.name ?? ''}
                      </Text>
                      <Text
                        className={cn('text-[13px]', inv.status === 'paid' ? 'text-link' : 'text-secondary')}
                        numberOfLines={1}
                      >
                        {invoiceLine(inv)}
                      </Text>
                    </View>
                    <Text className="text-fg text-base font-semibold">{formatAmount(inv.quote.total)}</Text>
                  </Pressable>
                </View>
              ))}
            </Group>
          </View>
        )}

        {nothing && <Text className="text-secondary text-[15px] mx-1">Nothing matches “{query.trim()}”.</Text>}
        {!searching && recent.length === 0 && (
          <Text className="text-secondary text-[15px] mx-1">Your customers, jobs and invoices will be searchable here.</Text>
        )}
      </ScrollView>
    </View>
  );
}
