/**
 * Everything for one customer: their jobs and invoices, what they've paid and still owe, a quick
 * call or text, and "New job for…". Handy for repeat customers.
 */
import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Linking } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Phone, MessageCircle, Navigation, Plus, ChevronRight } from 'lucide-react-native';
import { useTradeStore, useJobs, useInvoices, useSettings, jobName, invoiceNumberLabel } from '@/lib/store';
import { jobPosition } from '@/lib/jobSteps';
import { whereText } from '@/lib/jobText';
import { formatAmount } from '@/lib/money';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, SectionHeader, PrimaryButton, ModalHeader } from '@/components/ui';

export default function CustomerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const t = useTheme();
  const customer = useTradeStore((s) => s.customers.find((c) => c.id === id));
  const allJobs = useJobs();
  const allInvoices = useInvoices();
  const settings = useSettings();
  const close = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));

  const jobs = useMemo(
    () => allJobs.filter((j) => j.customerId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [allJobs, id],
  );
  const invoiceFor = useMemo(
    () => new Map(allInvoices.filter((i) => i.customerId === id).map((i) => [i.jobId, i])),
    [allInvoices, id],
  );
  const terms = settings.paymentTermsDays ?? 14;

  if (!customer) {
    return (
      <View className="flex-1 bg-bg">
        <ModalHeader title="Customer" onClose={close} />
        <Text className="text-secondary text-base text-center mt-10">This customer no longer exists.</Text>
      </View>
    );
  }

  const invoices = [...invoiceFor.values()];
  const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.quote.total, 0);
  const owed = invoices.filter((i) => i.status === 'sent').reduce((s, i) => s + i.quote.total, 0);
  const first = customer.name.trim().split(/\s+/)[0] || customer.name;
  const address = [customer.address, customer.postcode].filter(Boolean).join(', ');

  const actions = [
    { icon: Phone, text: 'Call', run: () => Linking.openURL(`tel:${customer.phone}`), show: !!customer.phone },
    { icon: MessageCircle, text: 'Text', run: () => Linking.openURL(`sms:${customer.phone}`), show: !!customer.phone },
    {
      icon: Navigation,
      text: 'Directions',
      run: () => Linking.openURL(`https://maps.apple.com/?daddr=${encodeURIComponent(address)}`),
      show: !!address,
    },
  ].filter((a) => a.show);

  return (
    <View className="flex-1 bg-bg">
      <ModalHeader title="Customer" onClose={close} />
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
        <Text className="text-fg text-[28px] font-bold tracking-tight" accessibilityRole="header">
          {customer.name}
        </Text>
        {!!address && <Text className="text-secondary text-base mt-0.5">{address}</Text>}
        {!!customer.email && <Text className="text-secondary text-[15px]">{customer.email}</Text>}

        {actions.length > 0 && (
          <Group className="flex-row mt-4 overflow-hidden">
            {actions.map(({ icon: Icon, text, run }, i) => (
              <Pressable
                key={text}
                onPress={run}
                className={cn(
                  'flex-1 flex-row items-center justify-center min-h-[48px] active:opacity-60',
                  i > 0 && 'border-l border-divider',
                )}
                accessibilityRole="button"
              >
                <Icon size={20} color={t.link} strokeWidth={2} />
                <Text className="text-link text-[15px] font-semibold ml-1.5">{text}</Text>
              </Pressable>
            ))}
          </Group>
        )}

        {/* At a glance */}
        <Group className="flex-row mt-3 py-3">
          {[
            { label: jobs.length === 1 ? 'Job' : 'Jobs', value: String(jobs.length), cls: 'text-fg' },
            { label: 'Paid', value: formatAmount(paid), cls: paid > 0 ? 'text-link' : 'text-fg' },
            { label: 'Owed', value: formatAmount(owed), cls: owed > 0 ? 'text-alert' : 'text-fg' },
          ].map((x) => (
            <View key={x.label} className="flex-1 items-center" accessible accessibilityLabel={`${x.label} ${x.value}`}>
              <Text className={cn('text-[20px] font-bold', x.cls)}>{x.value}</Text>
              <Text className="text-secondary text-xs">{x.label}</Text>
            </View>
          ))}
        </Group>

        <PrimaryButton
          icon={Plus}
          label={`New job for ${first}`}
          className="mt-4"
          onPress={() => router.push(`/add-job?customerId=${customer.id}`)}
        />

        <View className="mt-7">
          <SectionHeader title="Jobs and invoices" />
          <Group>
            {jobs.map((job, i) => {
              const inv = invoiceFor.get(job.id);
              const p = jobPosition(job, inv, terms);
              const total = inv?.quote.total ?? job.quote?.total;
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
                        {jobName(job, settings.trade)}
                        {inv ? ` · ${invoiceNumberLabel(inv)}` : ''}
                      </Text>
                      <Text
                        className={cn(
                          'text-[13px]',
                          p.overdueDays > 0 ? 'text-alert' : p.facts.paid ? 'text-link' : 'text-secondary',
                        )}
                        numberOfLines={1}
                      >
                        {whereText(job, inv, p, first, terms)}
                      </Text>
                    </View>
                    {total !== undefined && <Text className="text-fg text-base font-semibold mr-2">{formatAmount(total)}</Text>}
                    <ChevronRight size={16} color={t.secondary} strokeWidth={2} />
                  </Pressable>
                </View>
              );
            })}
            {jobs.length === 0 && <Text className="text-secondary text-[15px] p-4">No jobs yet.</Text>}
          </Group>
        </View>
      </ScrollView>
    </View>
  );
}
