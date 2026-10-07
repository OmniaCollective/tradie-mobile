import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput, Switch } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Trash2, Paperclip, CircleCheck, Lock, Send, Share2, Undo2, Wrench, BellRing, Eye } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  useTradeStore,
  useInvoices,
  useExpenses,
  useSettings,
  useRegion,
  getJobTypeLabel,
  invoiceNumberLabel,
  daysOverdue,
  useTaxSetAside,
  type Invoice,
  type Job,
  type Customer,
  type BusinessSettings,
  EXPENSE_CATEGORY_LABELS,
} from '@/lib/store';
import { ConfirmModal } from '@/components/ConfirmModal';
import { TaxExplainer } from '@/components/TaxExplainer';
import {
  exportCsv,
  exportExpensesCsv,
  exportTaxSummaryCsv,
  exportInvoicePdf,
  getDateRange,
  getPresetLabel,
  type DatePreset,
} from '@/lib/invoiceExport';
import { calculateTaxEstimate, calculateRolling12MonthTurnover } from '@/lib/taxEstimator';
import { calculateUSTax } from '@/lib/usTaxEstimator';
import { formatDate, parseDate } from '@/lib/dates';
import { formatMoney, formatPounds, currencySymbol } from '@/lib/money';
import { useBusinessDetailsPrompt } from '@/components/BusinessDetailsPrompt';
import { chaseInvoice } from '@/lib/chase';
import { useProAccess, FREE_LIMITS } from '@/lib/useProAccess';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, SectionHeader, PrimaryButton, Segmented, ProgressBar, ProTeaser, Sheet, LinkRow } from '@/components/ui';

type ViewMode = 'income' | 'expenses';
type ExportType = 'invoices' | 'expenses' | 'tax_summary';

const DATE_PRESETS: DatePreset[] = ['this_month', 'this_quarter', 'tax_year', 'all'];
const VAT_THRESHOLD = 90000; // HMRC registration threshold from 1 April 2024

const money = formatMoney;
const wholePounds = formatPounds;

/** What the customer actually pays the tradie: the total less any CIS the contractor deducted. */
const received = (invoice: Invoice) => invoice.quote.total - (invoice.cisDeducted ? invoice.cisDeductionAmount ?? 0 : 0);

export default function MoneyScreen() {
  const router = useRouter();
  // Opened from a job's "See invoice" link.
  const params = useLocalSearchParams<{ invoice?: string }>();
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(params.invoice ?? null);
  const [confirmDeleteInvoice, setConfirmDeleteInvoice] = useState<string | null>(null);
  const [confirmDeleteExpense, setConfirmDeleteExpense] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState<{ invoiceId: string; customerName: string } | null>(null);
  const deleteInvoice = useTradeStore((s) => s.deleteInvoice);
  // A new link opens that invoice (adjusting state during render, as React recommends over an effect).
  const [linkedInvoice, setLinkedInvoice] = useState(params.invoice);
  if (params.invoice !== linkedInvoice) {
    setLinkedInvoice(params.invoice);
    if (params.invoice) setOpenInvoiceId(params.invoice);
  }
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const invoices = useInvoices();
  const expenses = useExpenses();
  const settings = useSettings();
  const { requireDetails, prompt: detailsPrompt } = useBusinessDetailsPrompt();
  const { isPro, invoicesLeft } = useProAccess();
  const getCustomer = useTradeStore((s) => s.getCustomer);
  const getJob = useTradeStore((s) => s.getJob);
  const updateInvoice = useTradeStore((s) => s.updateInvoice);
  const deleteExpense = useTradeStore((s) => s.deleteExpense);
  const setTaxSetAside = useTradeStore((s) => s.setTaxSetAside);
  const taxSetAsideTotal = useTaxSetAside();

  const [viewMode, setViewMode] = useState<ViewMode>('income');
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    message: string;
    variant?: 'default' | 'success' | 'error' | 'warning';
  } | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exportType, setExportType] = useState<ExportType>('invoices');
  const [exporting, setExporting] = useState(false);
  const [cisModal, setCisModal] = useState<{
    invoiceId: string;
    total: number;
  } | null>(null);
  const [cisToggle, setCisToggle] = useState(false);
  const [cisAmount, setCisAmount] = useState('');
  const [showSetAsideInput, setShowSetAsideInput] = useState(false);
  const [setAsideAmount, setSetAsideAmount] = useState('');
  const [showExplainer, setShowExplainer] = useState(false);

  const openPaywall = () => router.push('/paywall');

  const groups = useMemo(() => {
    const byNewest = (a: Invoice, b: Invoice) => b.createdAt.localeCompare(a.createdAt);
    return {
      toSend: invoices.filter((i) => i.status === 'pending').sort(byNewest),
      waiting: invoices.filter((i) => i.status === 'sent').sort(byNewest),
      paid: invoices.filter((i) => i.status === 'paid').sort(byNewest),
    };
  }, [invoices]);

  const totals = useMemo(
    () => ({
      // What actually reaches the bank: CIS is held back by the contractor and paid to HMRC.
      outstanding: [...groups.toSend, ...groups.waiting].reduce((s, i) => s + received(i), 0),
      collected: groups.paid.reduce((s, i) => s + received(i), 0),
      expenses: expenses.reduce((s, e) => s + e.amount, 0),
    }),
    [groups, expenses],
  );

  const sortedExpenses = useMemo(() => [...expenses].sort((a, b) => b.date.localeCompare(a.date)), [expenses]);
  const tax = useMemo(() => calculateTaxEstimate(invoices, expenses, settings), [invoices, expenses, settings]);
  const turnover = useMemo(() => calculateRolling12MonthTurnover(invoices), [invoices]);
  const region = useRegion();
  const isUS = region.country === 'US';
  const usTax = useMemo(() => {
    if (!isUS) return null;
    const year = new Date().getFullYear();
    const inYear = (iso?: string) => !!iso && parseDate(iso).getFullYear() === year;
    return calculateUSTax({
      grossIncome: invoices.filter((i) => i.status === 'paid' && inYear(i.paidAt)).reduce((sum, i) => sum + i.quote.total - i.quote.vat, 0),
      businessExpenses: expenses.filter((e) => inYear(e.date)).reduce((sum, e) => sum + e.amount, 0),
      filingStatus: settings.usFilingStatus ?? 'single',
      otherIncome: settings.onlyIncomeSource ? 0 : settings.otherAnnualIncome,
      alreadySetAside: taxSetAsideTotal,
    });
  }, [isUS, invoices, expenses, settings, taxSetAsideTotal]);

  // One shape for the tax card, whichever country's rules apply.
  const taxView = usTax
    ? {
        headlineLabel: usTax.nextDue ? `Next payment · due ${formatDate(usTax.nextDue.toISOString())}` : 'Still to pay',
        headline: usTax.perPayment,
        owed: usTax.totalTax,
        lines: [
          ['Income', wholePounds(usTax.grossIncome)],
          ['Expenses', `−${wholePounds(usTax.businessExpenses)}`],
          ['Net profit', wholePounds(usTax.netProfit)],
          ['Self-employment tax', wholePounds(usTax.selfEmploymentTax)],
          ['Federal income tax', wholePounds(usTax.incomeTax)],
        ] as [string, string][],
        zeroNote: 'Your profit is too low for federal tax so far.',
        footnote: 'Federal only — state tax isn’t included. An estimate, not tax advice.',
      }
    : {
        headlineLabel: 'Set aside each month',
        headline: tax.monthlySetAside,
        owed: tax.taxOwed,
        lines: [
          ['Income', wholePounds(tax.grossIncome)],
          ['Expenses', `−${wholePounds(tax.totalExpenses)}`],
          ['Taxable profit', wholePounds(tax.taxableProfit)],
          ['Income Tax', wholePounds(tax.incomeTax)],
          ['Class 4 NI', wholePounds(tax.class4NI)],
          ...(tax.cisDeductions > 0 ? [['CIS already deducted', `−${wholePounds(tax.cisDeductions)}`]] : []),
          ...(tax.vatScheme !== 'none' && tax.vatCollected > 0 ? [['VAT owed to HMRC', wholePounds(tax.vatOwedToHMRC)]] : []),
        ] as [string, string][],
        zeroNote: 'Your profit is under your Personal Allowance so far, so there’s no tax to put away yet.',
        footnote: `${tax.monthsRemaining} months left in this tax year. An estimate, not tax advice.`,
      };
  const vatShare = turnover / VAT_THRESHOLD;

  // ── Invoice actions ────────────────────────────────────────────────────────

  const handleSendInvoice = async (invoice: Invoice) => {
    const customer = getCustomer(invoice.customerId);
    if (!customer) {
      setModal({
        title: 'Customer missing',
        message: 'This invoice has no customer attached.',
        variant: 'error',
      });
      return;
    }
    // Missing business details are asked for first, then the invoice goes out as a PDF.
    requireDetails('invoice', (current) => sendInvoicePdf(invoice, customer, current));
  };

  const sendInvoicePdf = async (invoice: Invoice, customer: Customer, current: BusinessSettings) => {
    setLoadingInvoiceId(invoice.id);
    try {
      const job = getJob(invoice.jobId);
      if (!job) throw new Error('Job not found');
      await exportInvoicePdf({ invoice, job, customer, settings: current });
      // iOS doesn't say whether it was actually sent, so ask before starting the due date.
      setConfirmSent({ invoiceId: invoice.id, customerName: customer.name });
    } catch (error) {
      if (__DEV__) console.error('Error sending invoice PDF:', error);
      setModal({
        title: 'Couldn’t create the PDF',
        message: 'Please try again.',
        variant: 'error',
      });
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  // A pre-written reminder from the tradie's phone; payment details must be set so the text says how to pay.
  const handleChase = (invoice: Invoice) => {
    const customer = getCustomer(invoice.customerId);
    const job = getJob(invoice.jobId);
    if (!customer || !job) return;
    requireDetails('invoice', async (current) => {
      try {
        if (await chaseInvoice(invoice, job, customer, current)) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch (error) {
        if (__DEV__) console.error('Chase failed:', error);
        setModal({ title: 'Couldn’t open the message', message: 'Please try again.', variant: 'error' });
      }
    });
  };

  const confirmMarkPaid = async (invoiceId: string, cisDeducted: boolean, cisDeductionAmount: number) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateInvoice(invoiceId, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      cisDeducted: cisDeducted || undefined,
      cisDeductionAmount: cisDeducted ? cisDeductionAmount : undefined,
    });
    setCisModal(null);
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    if (settings.cisRegistered) {
      setCisModal({ invoiceId: invoice.id, total: invoice.quote.total });
      setCisToggle(false);
      setCisAmount((invoice.quote.total * (settings.cisRate / 100)).toFixed(2));
      return;
    }
    await confirmMarkPaid(invoice.id, false, 0);
  };

  const handleSharePdf = (invoice: Invoice) => {
    const job = getJob(invoice.jobId);
    const customer = getCustomer(invoice.customerId);
    if (!job || !customer) return;
    requireDetails('invoice', (current) => shareInvoicePdf(invoice, job, customer, current));
  };

  const shareInvoicePdf = async (invoice: Invoice, job: Job, customer: Customer, current: BusinessSettings) => {
    setLoadingInvoiceId(invoice.id);
    try {
      await exportInvoicePdf({ invoice, job, customer, settings: current });
    } catch (error) {
      if (__DEV__) console.error('PDF export error:', error);
      setModal({
        title: 'Couldn’t create the PDF',
        message: 'Please try again.',
        variant: 'error',
      });
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleExport = async (preset: DatePreset) => {
    setExporting(true);
    setShowExport(false);
    try {
      const dateRange = getDateRange(preset);
      if (exportType === 'expenses') {
        await exportExpensesCsv({ expenses, settings, dateRange });
      } else if (exportType === 'tax_summary') {
        await exportTaxSummaryCsv({
          invoices,
          expenses,
          getJob,
          getCustomer,
          settings,
          taxEstimate: tax,
          usTax,
          dateRange,
        });
      } else {
        await exportCsv({ invoices, getJob, getCustomer, settings }, dateRange);
      }
    } catch (error) {
      if (__DEV__) console.error('CSV export error:', error);
      setModal({
        title: 'Export failed',
        message: 'Please try again.',
        variant: 'error',
      });
    } finally {
      setExporting(false);
    }
  };

  // The field holds the running total, so a mistake is fixed by typing the right figure.
  const saveSetAside = async () => {
    const total = parseFloat(setAsideAmount.replace(',', '.'));
    if (Number.isFinite(total) && total >= 0) {
      setTaxSetAside(total);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSetAsideAmount('');
    setShowSetAsideInput(false);
  };

  // ── Rows ───────────────────────────────────────────────────────────────────

  const renderInvoiceRow = (invoice: Invoice) => {
    const customer = getCustomer(invoice.customerId);
    const job = getJob(invoice.jobId);
    const loading = loadingInvoiceId === invoice.id;
    const state =
      invoice.status === 'paid'
        ? `Paid ${formatDate(invoice.paidAt)}`
        : invoice.status === 'sent'
          ? daysOverdue(invoice, settings) > 0
            ? `${daysOverdue(invoice, settings)} ${daysOverdue(invoice, settings) === 1 ? 'day' : 'days'} overdue`
            : `Sent ${formatDate(invoice.sentAt)}`
          : job
            ? getJobTypeLabel(settings.trade, job.type)
            : formatDate(invoice.createdAt);
    const detail = `${invoiceNumberLabel(invoice)} · ${state}`;

    // Paid on the spot is common, so an unsent invoice can be marked paid too.
    const actions =
      invoice.status === 'pending'
        ? [
            { label: 'Send', run: () => handleSendInvoice(invoice) },
            { label: 'Paid', run: () => handleMarkPaid(invoice) },
          ]
        : invoice.status === 'sent'
          ? [
              daysOverdue(invoice, settings) > 0
                ? { label: 'Chase', run: () => handleChase(invoice) }
                : { label: 'Resend', run: () => handleSharePdf(invoice) },
              { label: 'Mark paid', run: () => handleMarkPaid(invoice) },
            ]
          : [{ label: 'PDF', run: () => handleSharePdf(invoice) }];

    // Row body and its action are sibling tap targets, so VoiceOver can reach both.
    return (
      <View className="flex-row items-center pr-4">
        <Pressable
          onPress={() => setOpenInvoiceId(invoice.id)}
          className="flex-1 pl-4 py-3 mr-3 active:opacity-70"
          accessibilityRole="button"
          accessibilityHint="Shows everything you can do with this invoice"
        >
          <View>
            <Text className="text-fg text-base font-medium" numberOfLines={1}>
              {customer?.name ?? 'Unknown customer'}
            </Text>
            <View className="flex-row items-center mt-0.5">
              {invoice.status === 'paid' && <CircleCheck size={14} color={t.link} strokeWidth={2} />}
              <Text
                className={cn(
                  'text-sm',
                  invoice.status === 'paid' ? 'text-link ml-1' : daysOverdue(invoice, settings) > 0 ? 'text-alert' : 'text-secondary',
                )}
                numberOfLines={1}
              >
                {detail}
              </Text>
            </View>
            {invoice.cisDeducted && invoice.cisDeductionAmount ? (
              <Text className="text-secondary text-xs mt-0.5">CIS −{money(invoice.cisDeductionAmount)}</Text>
            ) : null}
          </View>
        </Pressable>
        <View className="items-end">
          <Text className="text-fg text-base font-semibold">{money(invoice.quote.total)}</Text>
          {loading ? (
            <ActivityIndicator size="small" color={t.link} className="mt-1" />
          ) : (
            <View className="flex-row gap-4 mt-0.5">
              {actions.map((a) => (
                <Pressable key={a.label} onPress={a.run} hitSlop={8} accessibilityRole="button">
                  <Text className="text-link text-sm font-semibold">{a.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderInvoiceGroup = (title: string, items: Invoice[]) =>
    items.length === 0 ? null : (
      <View className="mb-8">
        <SectionHeader title={title} />
        <Group>
          {items.map((invoice, i) => (
            <View key={invoice.id}>
              {i > 0 && <RowDivider />}
              {renderInvoiceRow(invoice)}
            </View>
          ))}
        </Group>
      </View>
    );

  // ── Screen ─────────────────────────────────────────────────────────────────

  return (
    <>
      <ScrollView
        className="flex-1 bg-bg"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: 32,
          paddingHorizontal: 16,
        }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-fg text-[28px] font-bold tracking-tight">Money</Text>
          <Pressable
            onPress={() => (isPro ? setShowExport(true) : openPaywall())}
            disabled={exporting}
            className="flex-row items-center min-h-[44px]"
            accessibilityRole="button"
          >
            {!isPro && <Lock size={14} color={t.link} strokeWidth={2} />}
            <Text className={cn('text-link text-[15px] font-semibold', !isPro && 'ml-1')}>
              {exporting ? 'Exporting…' : 'Export'}
            </Text>
          </Pressable>
        </View>

        {/* Totals */}
        <Group className="flex-row mb-8">
          <View className="flex-1 px-4 py-3.5">
            <Text className="text-secondary text-[13px]">Outstanding</Text>
            <Text className="text-fg text-[22px] font-bold tracking-tight mt-1">{money(totals.outstanding)}</Text>
          </View>
          <View className="w-px bg-divider" />
          <View className="flex-1 px-4 py-3.5">
            <Text className="text-secondary text-[13px]">Collected</Text>
            <Text className="text-fg text-[22px] font-bold tracking-tight mt-1">{money(totals.collected)}</Text>
          </View>
        </Group>

        {/* Tax */}
        <View className="mb-8">
          <SectionHeader title="Tax" />
          {isPro ? (
            <Group>
              <View className="flex-row px-4 pt-4 pb-3">
                <View className="flex-1">
                  <Text className="text-secondary text-[13px]">{taxView.headlineLabel}</Text>
                  <Text className="text-fg text-[28px] font-bold tracking-tight">{wholePounds(taxView.headline)}</Text>
                </View>
                <View className="items-end justify-end">
                  <Text className="text-secondary text-[13px]">Tax this year</Text>
                  <Text className="text-fg text-[17px] font-semibold">{wholePounds(taxView.owed)}</Text>
                </View>
              </View>

              <View className="px-4 pb-3">
                {taxView.lines.map(([label, value]) => (
                  <View key={label} className="flex-row justify-between py-1">
                    <Text className="text-secondary text-sm">{label}</Text>
                    <Text className="text-fg text-sm">{value}</Text>
                  </View>
                ))}
              </View>

              <RowDivider />
              <View className="px-4 py-3">
                <View className="flex-row justify-between mb-2">
                  <Text className="text-fg text-sm">Already set aside</Text>
                  <Text className="text-fg text-sm font-semibold">
                    {taxView.owed > 0 ? `${wholePounds(taxSetAsideTotal)} of ${wholePounds(taxView.owed)}` : wholePounds(taxSetAsideTotal)}
                  </Text>
                </View>
                {taxView.owed > 0 ? (
                  <ProgressBar value={taxSetAsideTotal / taxView.owed} />
                ) : (
                  <Text className="text-secondary text-[13px]">{taxView.zeroNote}</Text>
                )}
                {showSetAsideInput ? (
                  <View className="flex-row items-center mt-3">
                    <View className="flex-1 flex-row items-center bg-bg rounded-xl px-3 h-11 mr-2">
                      <Text className="text-secondary text-base mr-1">{currencySymbol()}</Text>
                      <TextInput
                        className="flex-1 text-fg text-base"
                        value={setAsideAmount}
                        onChangeText={setSetAsideAmount}
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor={t.secondary}
                        autoFocus
                        accessibilityLabel="Total set aside so far"
                      />
                    </View>
                    <PrimaryButton compact label="Save" onPress={saveSetAside} />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setSetAsideAmount(taxSetAsideTotal > 0 ? String(taxSetAsideTotal) : '');
                      setShowSetAsideInput(true);
                    }}
                    className="self-start min-h-[44px] justify-center"
                    accessibilityRole="button"
                  >
                    <Text className="text-link text-[15px] font-semibold">
                      {taxSetAsideTotal > 0 ? 'Update amount set aside' : 'I’ve set money aside'}
                    </Text>
                  </Pressable>
                )}
              </View>

              {!isUS && !settings.vatRegistered && turnover > 0 && (
                <>
                  <RowDivider />
                  <View className="px-4 py-3">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-fg text-sm">VAT threshold</Text>
                      <Text className={cn('text-sm', vatShare >= 0.9 ? 'text-alert font-semibold' : 'text-secondary')}>
                        {wholePounds(turnover)} of £90,000
                      </Text>
                    </View>
                    <ProgressBar value={vatShare} alert={vatShare >= 0.9} />
                    <Text className="text-secondary text-xs mt-2">
                      {vatShare >= 0.9
                        ? 'You’re close. If your turnover goes over £90,000, you have to register for VAT.'
                        : 'Turnover over the last 12 months.'}
                    </Text>
                  </View>
                </>
              )}

              {!isUS && tax.vatScheme === 'flat_rate' && (
                <Text className="text-secondary text-xs px-4 pb-3">
                  Income is shown after HMRC’s {settings.vatFlatRatePercent}% flat rate, so it’s lower than your invoice totals.
                </Text>
              )}
              <RowDivider />
              <Pressable onPress={() => setShowExplainer(true)} className="px-4 py-3 active:opacity-70" accessibilityRole="button">
                <Text className="text-link text-[15px] font-semibold">How this is worked out</Text>
                <Text className="text-secondary text-xs mt-0.5">{taxView.footnote}</Text>
              </Pressable>
            </Group>
          ) : (
            <Pressable onPress={openPaywall} accessibilityRole="button" accessibilityLabel="Tax estimate, unlock with Pro">
              <Group className="p-4">
                <View className="flex-row">
                  <View className="flex-1">
                    <Text className="text-secondary text-[13px]">{isUS ? 'Next quarterly payment' : 'Set aside each month'}</Text>
                    <Text className="text-secondary text-[28px] font-bold tracking-widest">{currencySymbol()} •••</Text>
                  </View>
                  <View className="items-end justify-end">
                    <Text className="text-secondary text-[13px]">Tax this year</Text>
                    <Text className="text-secondary text-[17px] font-semibold tracking-widest">{currencySymbol()} •••</Text>
                  </View>
                </View>
                <Text className="text-secondary text-[15px] leading-5 mt-3">
                  {isUS
                    ? 'See your federal and self-employment tax as you go, and what to pay each quarter — worked out from your invoices and expenses.'
                    : 'See what to put away for HMRC each month, worked out from your invoices and expenses — plus a VAT threshold tracker.'}
                </Text>
                <View className="flex-row items-center min-h-[44px]">
                  <Lock size={16} color={t.link} strokeWidth={2} />
                  <Text className="text-link text-[15px] font-semibold ml-1.5">Unlock with Pro</Text>
                </View>
              </Group>
            </Pressable>
          )}
        </View>

        <Segmented
          className="mb-6"
          options={[
            { key: 'income', label: 'Invoices' },
            { key: 'expenses', label: 'Expenses' },
          ]}
          value={viewMode}
          onChange={setViewMode}
        />

        {viewMode === 'income' && !isPro && (
          <Pressable onPress={openPaywall} className="flex-row items-center justify-between mx-1 mb-4" accessibilityRole="button">
            <Text className={cn('text-[13px]', invoicesLeft === 0 ? 'text-alert' : 'text-secondary')}>
              {invoicesLeft === 0
                ? `You’ve used this month’s ${FREE_LIMITS.invoicesPerMonth} free invoices`
                : `${invoicesLeft} of ${FREE_LIMITS.invoicesPerMonth} free invoices left this month`}
            </Text>
            <Text className="text-link text-[13px] font-semibold">Go unlimited</Text>
          </Pressable>
        )}

        {viewMode === 'income' ? (
          invoices.length === 0 ? (
            <Group className="p-4">
              <Text className="text-fg text-base font-semibold mb-1">No invoices yet</Text>
              <Text className="text-secondary text-[15px] leading-5">
                Finish a job and tap Create invoice — it will show up here.
              </Text>
            </Group>
          ) : (
            <>
              {renderInvoiceGroup('To send', groups.toSend)}
              {renderInvoiceGroup('Waiting for payment', groups.waiting)}
              {renderInvoiceGroup('Paid', groups.paid)}
            </>
          )
        ) : !isPro ? (
          <ProTeaser
            title="Expenses and receipts"
            body="Log costs with a photo of the receipt, and they come off your tax estimate automatically. Export the tax year for your accountant."
            onUnlock={openPaywall}
          />
        ) : (
          <View>
            <View className="flex-row items-baseline justify-between mx-1 mb-2.5">
              <Text className="text-fg text-[17px] font-semibold">{money(totals.expenses)}</Text>
              <Text className="text-secondary text-sm">
                {expenses.length} {expenses.length === 1 ? 'expense' : 'expenses'}
              </Text>
            </View>
            <Group>
              <Pressable
                onPress={() => router.push('/add-expense')}
                className="flex-row items-center px-4 min-h-[52px] active:opacity-70"
                accessibilityRole="button"
              >
                <Plus size={20} color={t.link} strokeWidth={2} />
                <Text className="text-link text-base font-semibold ml-2">Add expense</Text>
              </Pressable>
              {sortedExpenses.map((expense) => (
                <View key={expense.id}>
                  <RowDivider />
                  <View className="flex-row items-center pl-4 py-2.5">
                    <Pressable
                      onPress={() => router.push(`/add-expense?id=${expense.id}`)}
                      className="flex-1 mr-3 active:opacity-70"
                      accessibilityRole="button"
                      accessibilityHint="Edit this expense"
                    >
                      <Text className="text-fg text-base" numberOfLines={1}>
                        {expense.description}
                      </Text>
                      <View className="flex-row items-center mt-0.5">
                        <Text className="text-secondary text-sm" numberOfLines={1}>
                          {formatDate(expense.date)} · {EXPENSE_CATEGORY_LABELS[expense.category]}
                          {expense.miles ? ` · ${expense.miles} miles` : ''}
                        </Text>
                        {expense.receiptUri && (
                          <Paperclip size={14} color={t.secondary} strokeWidth={2} style={{ marginLeft: 6 }} />
                        )}
                      </View>
                    </Pressable>
                    <Text className="text-fg text-base font-semibold">{money(expense.amount)}</Text>
                    <Pressable
                      onPress={() => setConfirmDeleteExpense(expense.id)}
                      className="w-11 h-11 items-center justify-center active:opacity-60"
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${expense.description}`}
                    >
                      <Trash2 size={16} color={t.secondary} strokeWidth={2} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </Group>
          </View>
        )}
      </ScrollView>

      {/* Mark paid with CIS */}
      {/* Everything you can do with one invoice */}
      {(() => {
        const invoice = invoices.find((i) => i.id === openInvoiceId);
        if (!invoice) return null;
        const close = () => {
          setOpenInvoiceId(null);
          router.setParams({ invoice: undefined });
        };
        const then = (run: () => void) => () => {
          close();
          run();
        };
        const customer = getCustomer(invoice.customerId);
        return (
          <Sheet visible onClose={close}>
            <Text className="text-secondary text-[13px]">{invoiceNumberLabel(invoice)}</Text>
            <View className="flex-row items-baseline justify-between mb-1">
              <Text className="text-fg text-[20px] font-semibold flex-1 mr-3" numberOfLines={1}>
                {customer?.name ?? 'Unknown customer'}
              </Text>
              <Text className="text-fg text-[20px] font-semibold">{money(invoice.quote.total)}</Text>
            </View>
            <Text className={cn('text-[15px] mb-4', invoice.status === 'paid' ? 'text-link' : 'text-secondary')}>
              {invoice.status === 'paid'
                ? `Paid ${formatDate(invoice.paidAt)}`
                : invoice.status === 'sent'
                  ? `Sent ${formatDate(invoice.sentAt)} · not paid yet`
                  : 'Not sent yet'}
              {invoice.cisDeducted && invoice.cisDeductionAmount ? ` · CIS −${money(invoice.cisDeductionAmount)}` : ''}
            </Text>
            <Group className="bg-bg mb-4">
              <LinkRow
                icon={Eye}
                label={invoice.status === 'paid' ? 'View invoice' : 'Preview and edit'}
                onPress={then(() => router.push(`/preview?kind=invoice&id=${invoice.id}`))}
              />
              <RowDivider />
              {invoice.status === 'pending' && <LinkRow icon={Send} label="Send invoice" onPress={then(() => handleSendInvoice(invoice))} />}
              {invoice.status === 'sent' && (
                <>
                  <LinkRow
                    icon={BellRing}
                    label={daysOverdue(invoice, settings) > 0 ? 'Chase payment' : 'Send payment reminder'}
                    value={invoice.chasedAt?.length ? `Chased ${formatDate(invoice.chasedAt[invoice.chasedAt.length - 1])}` : undefined}
                    onPress={then(() => handleChase(invoice))}
                  />
                  <RowDivider />
                </>
              )}
              {invoice.status !== 'pending' && (
                <LinkRow
                  icon={Share2}
                  label={invoice.status === 'paid' ? 'Share PDF' : 'Send again'}
                  onPress={then(() => handleSharePdf(invoice))}
                />
              )}
              <RowDivider />
              {invoice.status === 'paid' ? (
                <LinkRow
                  icon={Undo2}
                  label="Mark as not paid"
                  onPress={then(() =>
                    updateInvoice(invoice.id, {
                      status: invoice.sentAt ? 'sent' : 'pending',
                      paidAt: undefined,
                    }),
                  )}
                />
              ) : (
                <LinkRow icon={CircleCheck} label="Mark paid" onPress={then(() => handleMarkPaid(invoice))} />
              )}
              <RowDivider />
              <LinkRow icon={Wrench} label="Open job" onPress={then(() => router.push(`/job/${invoice.jobId}`))} />
              <RowDivider />
              <LinkRow icon={Trash2} label="Delete invoice" destructive onPress={then(() => setConfirmDeleteInvoice(invoice.id))} />
            </Group>
          </Sheet>
        );
      })()}

      <ConfirmModal
        visible={!!confirmSent}
        title="Did you send it?"
        message={`Mark the invoice to ${confirmSent?.customerName ?? 'the customer'} as sent? Its due date starts today.`}
        confirmText="Yes, mark as sent"
        cancelText="Not yet"
        onConfirm={async () => {
          if (!confirmSent) return;
          updateInvoice(confirmSent.invoiceId, { status: 'sent', sentAt: new Date().toISOString() });
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }}
        onCancel={() => {}}
        onDismiss={() => setConfirmSent(null)}
      />

      <ConfirmModal
        visible={!!confirmDeleteExpense}
        title="Delete this expense?"
        message="It will no longer count towards your expenses or tax."
        confirmText="Delete"
        cancelText="Cancel"
        variant="error"
        onConfirm={async () => {
          if (!confirmDeleteExpense) return;
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          deleteExpense(confirmDeleteExpense);
        }}
        onCancel={() => {}}
        onDismiss={() => setConfirmDeleteExpense(null)}
      />

      <ConfirmModal
        visible={!!confirmDeleteInvoice}
        title="Delete this invoice?"
        message="The job goes back to Done, so you can fix the price and invoice it again. Delete an invoice only if it was made by mistake."
        confirmText="Delete invoice"
        cancelText="Cancel"
        variant="error"
        onConfirm={() => confirmDeleteInvoice && deleteInvoice(confirmDeleteInvoice)}
        onCancel={() => {}}
        onDismiss={() => setConfirmDeleteInvoice(null)}
      />

      <Sheet visible={!!cisModal} onClose={() => setCisModal(null)}>
        <Text className="text-fg text-[17px] font-semibold text-center mb-4">Mark as paid</Text>
        <View className="bg-bg rounded-2xl px-4 mb-4">
          <View className="flex-row items-center justify-between min-h-[52px]">
            <Text className="text-fg text-base">CIS deducted?</Text>
            <Switch value={cisToggle} onValueChange={setCisToggle} trackColor={{ false: t.divider, true: t.accent }} />
          </View>
          {cisToggle && cisModal && (
            <View className="border-t border-divider py-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-secondary text-sm">Deduction</Text>
                <View className="flex-row items-center bg-surface rounded-xl px-3 h-11">
                  <Text className="text-secondary mr-1">£</Text>
                  <TextInput
                    className="text-fg text-base w-20 text-right"
                    value={cisAmount}
                    onChangeText={setCisAmount}
                    keyboardType="decimal-pad"
                    accessibilityLabel="CIS deduction amount"
                  />
                </View>
              </View>
              <Text className="text-secondary text-xs mt-2">
                You receive {money(cisModal.total - (parseFloat(cisAmount) || 0))}
              </Text>
            </View>
          )}
        </View>
        <PrimaryButton
          label="Confirm payment"
          onPress={() => cisModal && confirmMarkPaid(cisModal.invoiceId, cisToggle, parseFloat(cisAmount) || 0)}
        />
        <Pressable
          onPress={() => setCisModal(null)}
          className="min-h-[48px] items-center justify-center mt-1"
          accessibilityRole="button"
        >
          <Text className="text-secondary text-base font-semibold">Cancel</Text>
        </Pressable>
      </Sheet>

      {/* Export */}
      <Sheet visible={showExport} onClose={() => setShowExport(false)}>
        <Text className="text-fg text-[17px] font-semibold text-center mb-4">Export a spreadsheet</Text>
        <Segmented
          className="mb-4 bg-bg"
          options={[
            { key: 'invoices', label: 'Invoices' },
            { key: 'expenses', label: 'Expenses' },
            { key: 'tax_summary', label: 'Tax summary' },
          ]}
          value={exportType}
          onChange={setExportType}
        />
        <Text className="text-secondary text-[13px] mx-1 mb-2">Period</Text>
        <View className="bg-bg rounded-2xl overflow-hidden">
          {DATE_PRESETS.map((preset, i) => (
            <View key={preset}>
              {i > 0 && <RowDivider />}
              <Pressable
                onPress={() => handleExport(preset)}
                className="px-4 min-h-[52px] justify-center active:opacity-70"
                accessibilityRole="button"
              >
                <Text className="text-fg text-base">{getPresetLabel(preset)}</Text>
              </Pressable>
            </View>
          ))}
        </View>
        <Pressable
          onPress={() => setShowExport(false)}
          className="min-h-[48px] items-center justify-center mt-2"
          accessibilityRole="button"
        >
          <Text className="text-secondary text-base font-semibold">Cancel</Text>
        </Pressable>
      </Sheet>

      <TaxExplainer visible={showExplainer} onClose={() => setShowExplainer(false)} />

      {modal && (
        <ConfirmModal
          visible={!!modal}
          title={modal.title}
          message={modal.message}
          variant={modal.variant}
          onDismiss={() => setModal(null)}
        />
      )}
      {detailsPrompt}
    </>
  );
}
