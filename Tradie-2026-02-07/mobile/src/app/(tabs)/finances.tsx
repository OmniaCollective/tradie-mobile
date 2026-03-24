import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  FileText,
  CheckCircle,
  Send,
  AlertCircle,
  RefreshCw,
  Plus,
  Trash2,
  Receipt,
  Settings,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  useTradeStore,
  useInvoices,
  useExpenses,
  useSettings,
  Invoice,
  Expense,
  EXPENSE_CATEGORY_LABELS,
} from '@/lib/store';
import { sendPaymentReceivedNotification } from '@/lib/notifications';
import { paymentsApi } from '@/lib/paymentsApi';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  exportCsv,
  exportExpensesCsv,
  exportTaxSummaryCsv,
  exportInvoicePdf,
  getDateRange,
  getPresetLabel,
  DatePreset,
} from '@/lib/invoiceExport';
import {
  calculateTaxEstimate,
  calculateRolling12MonthTurnover,
  TaxEstimate,
} from '@/lib/taxEstimator';

const TURQUOISE = '#14B8A6';

type ViewMode = 'income' | 'expenses';
type FilterType = 'all' | 'pending' | 'sent' | 'paid';

const DATE_PRESETS: DatePreset[] = ['this_month', 'this_quarter', 'tax_year', 'all'];

export default function FinancesScreen() {
  const router = useRouter();
  const invoices = useInvoices();
  const expenses = useExpenses();
  const settings = useSettings();
  const { getCustomer, updateInvoice, getJob, deleteExpense, addTaxSetAside } = useTradeStore();
  const taxSetAsideTotal = useTradeStore((s) => s.taxSetAsideTotal);

  const [viewMode, setViewMode] = useState<ViewMode>('income');
  const [filter, setFilter] = useState<FilterType>('all');
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState<{ title: string; message: string; variant?: 'default' | 'success' | 'error' | 'warning' } | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState<'invoices' | 'expenses' | 'tax_summary'>('invoices');
  const [exporting, setExporting] = useState(false);
  const [cisModal, setCisModal] = useState<{ invoiceId: string; total: number } | null>(null);
  const [cisToggle, setCisToggle] = useState(false);
  const [cisAmount, setCisAmount] = useState('');
  const [showSetAsideInput, setShowSetAsideInput] = useState(false);
  const [setAsideAmount, setSetAsideAmount] = useState('');

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    if (filter === 'all') return invoices;
    return invoices.filter((inv) => inv.status === filter);
  }, [invoices, filter]);

  // Sort expenses by date (newest first)
  const sortedExpenses = useMemo(() =>
    [...expenses].sort((a, b) => b.date.localeCompare(a.date)),
  [expenses]);

  // Calculate totals
  const totals = useMemo(() => {
    const pending = invoices
      .filter((inv) => inv.status === 'pending' || inv.status === 'sent')
      .reduce((sum, inv) => sum + inv.quote.total, 0);
    const paid = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.quote.total, 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    return { pending, paid, expenses: totalExpenses };
  }, [invoices, expenses]);

  // Tax estimate for Set Aside card
  const taxEstimate = useMemo(
    () => calculateTaxEstimate(invoices, expenses, settings),
    [invoices, expenses, settings],
  );

  // VAT threshold tracking (rolling 12-month turnover)
  const VAT_THRESHOLD = 90000; // 2024/25 threshold
  const rolling12MonthTurnover = useMemo(
    () => calculateRolling12MonthTurnover(invoices),
    [invoices],
  );
  const vatThresholdPercent = Math.min(100, (rolling12MonthTurnover / VAT_THRESHOLD) * 100);

  // Check payment status for all sent invoices
  const checkAllPaymentStatuses = useCallback(async () => {
    const sentInvoices = invoices.filter((inv) => inv.status === 'sent');

    for (const invoice of sentInvoices) {
      try {
        const result = await paymentsApi.checkPaymentStatus(invoice.id);
        if (result.success && result.status === 'paid') {
          const customer = getCustomer(invoice.customerId);
          updateInvoice(invoice.id, {
            status: 'paid',
            paidAt: result.paidAt || new Date().toISOString(),
          });

          if (customer) {
            await sendPaymentReceivedNotification(customer.name, invoice.quote.total);
          }
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
      }
    }
  }, [invoices, getCustomer, updateInvoice]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkAllPaymentStatuses();
    setRefreshing(false);
  }, [checkAllPaymentStatuses]);

  const handleSendInvoice = async (invoice: Invoice) => {
    const customer = getCustomer(invoice.customerId);
    if (!customer) {
      setModal({ title: 'Error', message: 'Customer not found', variant: 'error' });
      return;
    }

    // Check business details are complete before first send
    if (!settings.businessName || settings.businessName === 'TRADIE') {
      setModal({
        title: 'Complete Your Details',
        message: 'Add your business name in Settings before sending invoices. This appears on invoices sent to customers.',
        variant: 'warning',
      });
      return;
    }

    if (!settings.email && !settings.phone) {
      setModal({
        title: 'Add Contact Info',
        message: 'Add your email or phone number in Settings so customers can reach you about invoices.',
        variant: 'warning',
      });
      return;
    }

    setLoadingInvoiceId(invoice.id);

    try {
      let paymentLink = invoice.stripePaymentLink;
      const userId = `user_${settings.businessName.replace(/\s/g, '_')}_${settings.phone.replace(/\s/g, '')}` || 'default_user';

      if (!paymentLink) {
        const result = await paymentsApi.createInvoice({
          id: invoice.id,
          jobId: invoice.jobId,
          customerId: invoice.customerId,
          customerName: customer.name,
          customerEmail: customer.email,
          customerPhone: customer.phone || undefined,
          customerAddress: customer.address ? `${customer.address}, ${customer.postcode}` : undefined,
          businessName: settings.businessName || 'TRADIE',
          businessEmail: settings.email || undefined,
          businessPhone: settings.phone || undefined,
          labour: invoice.quote.labour,
          materials: invoice.quote.materials,
          travel: invoice.quote.travel,
          emergencySurcharge: invoice.quote.emergencySurcharge,
          vat: invoice.quote.vat,
          total: invoice.quote.total,
          userId: userId,
        });

        if (!result.success || !result.paymentLink) {
          throw new Error(result.error || 'Failed to create payment link');
        }

        paymentLink = result.paymentLink;
        updateInvoice(invoice.id, { stripePaymentLink: paymentLink });
      }

      await Share.share({
        message: `Hi ${customer.name},\n\nPlease find your invoice for £${invoice.quote.total.toFixed(2)} from ${settings.businessName || 'TRADIE'}.\n\nPay securely here: ${paymentLink}\n\nThank you for your business!`,
        title: `Invoice from ${settings.businessName || 'TRADIE'}`,
      });

      await paymentsApi.markInvoiceSent(invoice.id);
      updateInvoice(invoice.id, {
        status: 'sent',
        sentAt: new Date().toISOString(),
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error sending invoice:', error);
      setModal({ title: 'Error', message: 'Failed to create payment link. Please check your internet connection and try again.', variant: 'error' });
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleCheckPayment = async (invoice: Invoice) => {
    setLoadingInvoiceId(invoice.id);

    try {
      const result = await paymentsApi.checkPaymentStatus(invoice.id);

      if (!result.success) {
        setModal({ title: 'Connection Error', message: result.error === 'Network error' ? 'Could not reach the payment server. Check your internet connection.' : (result.error || 'Failed to check payment status.'), variant: 'error' });
      } else if (result.status === 'paid') {
        const customer = getCustomer(invoice.customerId);

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        updateInvoice(invoice.id, {
          status: 'paid',
          paidAt: result.paidAt || new Date().toISOString(),
        });

        if (customer) {
          await sendPaymentReceivedNotification(customer.name, invoice.quote.total);
        }

        setModal({ title: 'Payment Received!', message: `£${invoice.quote.total.toFixed(2)} has been paid.`, variant: 'success' });
      } else {
        setModal({ title: 'Payment Pending', message: 'This invoice has not been paid yet.', variant: 'warning' });
      }
    } catch (error) {
      console.error('Error checking payment:', error);
      setModal({ title: 'Connection Error', message: 'Could not reach the payment server. Check your internet connection and try again.', variant: 'error' });
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (!invoice) return;

    // If CIS is enabled, show CIS modal first
    if (settings.cisRegistered) {
      setCisModal({ invoiceId, total: invoice.quote.total });
      setCisToggle(false);
      setCisAmount((invoice.quote.total * 0.2).toFixed(2)); // Default 20% CIS
      return;
    }

    await confirmMarkPaid(invoiceId, false, 0);
  };

  const confirmMarkPaid = async (invoiceId: string, cisDeducted: boolean, cisDeductionAmount: number) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    const customer = invoice ? getCustomer(invoice.customerId) : null;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateInvoice(invoiceId, {
      status: 'paid',
      paidAt: new Date().toISOString(),
      cisDeducted: cisDeducted || undefined,
      cisDeductionAmount: cisDeducted ? cisDeductionAmount : undefined,
    });

    if (customer && invoice) {
      await sendPaymentReceivedNotification(customer.name, invoice.quote.total);
    }

    setCisModal(null);
  };

  const handleExportCsv = async (preset: DatePreset) => {
    setExporting(true);
    setShowExportModal(false);
    try {
      const dateRange = getDateRange(preset);
      if (exportType === 'expenses') {
        await exportExpensesCsv({ expenses, dateRange });
      } else if (exportType === 'tax_summary') {
        await exportTaxSummaryCsv({
          invoices, expenses, getJob, getCustomer, settings,
          taxEstimate, dateRange,
        });
      } else {
        await exportCsv(
          { invoices, getJob, getCustomer, settings },
          dateRange,
        );
      }
    } catch (error) {
      console.error('CSV export error:', error);
      setModal({ title: 'Export Failed', message: 'Could not export. Please try again.', variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const handleSharePdf = async (invoice: Invoice) => {
    const job = getJob(invoice.jobId);
    const customer = getCustomer(invoice.customerId);
    if (!job || !customer) return;

    setLoadingInvoiceId(invoice.id);
    try {
      await exportInvoicePdf({ invoice, job, customer, settings });
    } catch (error) {
      console.error('PDF export error:', error);
      setModal({ title: 'Export Failed', message: 'Could not generate PDF. Please try again.', variant: 'error' });
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    deleteExpense(id);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusColor = (status: Invoice['status']) => {
    switch (status) {
      case 'pending': return '#F59E0B';
      case 'sent': return '#8B5CF6';
      case 'paid': return '#22C55E';
      default: return '#64748B';
    }
  };

  const getStatusLabel = (status: Invoice['status']) => {
    switch (status) {
      case 'pending': return 'Draft';
      case 'sent': return 'Sent';
      case 'paid': return 'Paid';
      default: return status;
    }
  };

  const filterOptions: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'paid', label: 'Paid' },
  ];

  return (
    <>
    <ScrollView
      className="flex-1 bg-[#0F172A]"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={TURQUOISE}
        />
      }
    >
      <View className="px-4 pb-8">
        {/* Summary Cards */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          className="flex-row gap-3 mb-6"
        >
          <View className="flex-1 bg-[#1E293B] rounded-2xl border border-[#334155] p-4">
            <View className="flex-row items-center mb-2">
              <AlertCircle size={16} color="#F59E0B" />
              <Text className="text-slate-400 text-xs ml-2">Outstanding</Text>
            </View>
            <Text className="text-white font-bold text-2xl">
              £{totals.pending.toFixed(2)}
            </Text>
          </View>
          <View className="flex-1 bg-[#1E293B] rounded-2xl border border-[#334155] p-4">
            <View className="flex-row items-center mb-2">
              <CheckCircle size={16} color="#22C55E" />
              <Text className="text-slate-400 text-xs ml-2">Collected</Text>
            </View>
            <Text className="text-white font-bold text-2xl">
              £{totals.paid.toFixed(2)}
            </Text>
          </View>
        </Animated.View>

        {/* Set Aside Card */}
        {taxEstimate.taxableProfit > 0 && (
          <Animated.View
            entering={FadeInDown.delay(150).duration(400)}
            className="mb-4"
          >
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-slate-400 text-xs uppercase tracking-wide">
                  Tax Year Set Aside
                </Text>
                <Pressable
                  onPress={() => router.push('/(tabs)/settings')}
                  className="p-1 active:opacity-70"
                >
                  <Settings size={14} color="#64748B" />
                </Pressable>
              </View>
              <View className="flex-row items-end justify-between mb-3">
                <View>
                  <Text className="text-white font-bold text-2xl">
                    £{taxEstimate.monthlySetAside.toFixed(0)}
                  </Text>
                  <Text className="text-slate-500 text-xs">per month</Text>
                </View>
                <View className="items-end">
                  <Text className="text-slate-300 text-base font-semibold">
                    £{taxEstimate.taxOwed.toFixed(0)}
                  </Text>
                  <Text className="text-slate-500 text-xs">estimated tax owed</Text>
                </View>
              </View>

              {/* Tax breakdown */}
              <View className="bg-[#0F172A] rounded-xl p-3">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-slate-500 text-xs">Gross income</Text>
                  <Text className="text-slate-400 text-xs">£{taxEstimate.grossIncome.toFixed(0)}</Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-slate-500 text-xs">Expenses</Text>
                  <Text className="text-slate-400 text-xs">−£{taxEstimate.totalExpenses.toFixed(0)}</Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-slate-500 text-xs">Taxable profit</Text>
                  <Text className="text-slate-400 text-xs">£{taxEstimate.taxableProfit.toFixed(0)}</Text>
                </View>
                <View className="border-t border-[#334155] mt-1 pt-1">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-slate-500 text-xs">Income tax</Text>
                    <Text className="text-slate-400 text-xs">£{taxEstimate.incomeTax.toFixed(0)}</Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-slate-500 text-xs">Class 4 NI</Text>
                    <Text className="text-slate-400 text-xs">£{taxEstimate.class4NI.toFixed(0)}</Text>
                  </View>
                  {taxEstimate.cisDeductions > 0 && (
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-slate-500 text-xs">CIS deducted</Text>
                      <Text className="text-green-400 text-xs">−£{taxEstimate.cisDeductions.toFixed(0)}</Text>
                    </View>
                  )}
                  {taxEstimate.vatScheme !== 'none' && taxEstimate.vatCollected > 0 && (
                    <View className="border-t border-[#334155] mt-1 pt-1">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-slate-500 text-xs">VAT collected</Text>
                        <Text className="text-slate-400 text-xs">£{taxEstimate.vatCollected.toFixed(0)}</Text>
                      </View>
                      {taxEstimate.vatInputTax > 0 && taxEstimate.vatScheme === 'standard' && (
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-slate-500 text-xs">Input VAT (reclaimable)</Text>
                          <Text className="text-green-400 text-xs">−£{taxEstimate.vatInputTax.toFixed(0)}</Text>
                        </View>
                      )}
                      <View className="flex-row justify-between">
                        <Text className="text-slate-500 text-xs">VAT owed to HMRC</Text>
                        <Text className="text-slate-400 text-xs">£{taxEstimate.vatOwedToHMRC.toFixed(0)}</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
              {taxEstimate.vatScheme === 'flat_rate' && (
                <Text className="text-slate-600 text-[10px] mt-2">
                  Flat Rate VAT: gross income shown is after HMRC's {settings.vatFlatRatePercent}% flat rate. This differs from invoice totals because you keep the VAT difference.
                </Text>
              )}
              {/* Set aside tracker */}
              <View className="mt-3 pt-3 border-t border-[#334155]">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-slate-400 text-xs">Already set aside</Text>
                  <Text className="text-white text-xs font-semibold">£{taxSetAsideTotal.toFixed(0)}</Text>
                </View>
                {taxSetAsideTotal > 0 && (
                  <View className="h-2 bg-[#0F172A] rounded-full overflow-hidden mb-2">
                    <View
                      className="h-full rounded-full bg-[#22C55E]"
                      style={{ width: `${Math.min(100, (taxSetAsideTotal / Math.max(1, taxEstimate.taxOwed)) * 100)}%` }}
                    />
                  </View>
                )}
                {showSetAsideInput ? (
                  <View className="flex-row gap-2">
                    <View className="flex-1 flex-row items-center bg-[#0F172A] rounded-lg px-3 py-2">
                      <Text className="text-slate-400 mr-1">£</Text>
                      <TextInput
                        className="flex-1 text-white text-sm"
                        value={setAsideAmount}
                        onChangeText={setSetAsideAmount}
                        keyboardType="decimal-pad"
                        placeholder={taxEstimate.monthlySetAside.toFixed(0)}
                        placeholderTextColor="#475569"
                        autoFocus
                      />
                    </View>
                    <Pressable
                      onPress={async () => {
                        const amt = parseFloat(setAsideAmount) || 0;
                        if (amt > 0) {
                          addTaxSetAside(amt);
                          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        }
                        setSetAsideAmount('');
                        setShowSetAsideInput(false);
                      }}
                      className="bg-[#22C55E] rounded-lg px-4 items-center justify-center active:opacity-80"
                    >
                      <Text className="text-white font-bold text-sm">Save</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => setShowSetAsideInput(true)}
                    className="bg-[#0F172A] rounded-lg py-2.5 items-center active:opacity-80"
                  >
                    <Text className="text-[#14B8A6] font-medium text-xs">I've set money aside</Text>
                  </Pressable>
                )}
              </View>

              <Text className="text-slate-600 text-[10px] mt-2 text-center">
                Estimate only — {taxEstimate.monthsRemaining} months remaining in tax year
              </Text>
            </View>
          </Animated.View>
        )}

        {/* VAT Threshold Tracker — show when not VAT registered */}
        {!settings.vatRegistered && rolling12MonthTurnover > 0 && (
          <Animated.View
            entering={FadeInDown.delay(175).duration(400)}
            className="mb-4"
          >
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-slate-400 text-xs uppercase tracking-wide">
                  VAT Threshold
                </Text>
                <Text className="text-slate-500 text-xs">
                  £{(rolling12MonthTurnover / 1000).toFixed(1)}k / £{(VAT_THRESHOLD / 1000).toFixed(0)}k
                </Text>
              </View>
              {/* Progress bar */}
              <View className="h-3 bg-[#0F172A] rounded-full overflow-hidden mb-2">
                <View
                  className="h-full rounded-full"
                  style={{
                    width: `${vatThresholdPercent}%`,
                    backgroundColor: vatThresholdPercent >= 90 ? '#EF4444' : vatThresholdPercent >= 75 ? '#F59E0B' : TURQUOISE,
                  }}
                />
              </View>
              <Text className="text-slate-500 text-[10px]">
                {vatThresholdPercent >= 90
                  ? 'Approaching VAT registration threshold — consider registering'
                  : `Rolling 12-month turnover (${vatThresholdPercent.toFixed(0)}% of threshold)`}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Income / Expenses Toggle */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          className="flex-row bg-[#1E293B] rounded-xl p-1 mb-4"
        >
          <Pressable
            onPress={() => setViewMode('income')}
            className={`flex-1 py-2.5 rounded-lg ${viewMode === 'income' ? 'bg-[#14B8A6]' : ''}`}
          >
            <Text className={`text-center font-semibold text-sm ${viewMode === 'income' ? 'text-white' : 'text-slate-400'}`}>
              Income
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setViewMode('expenses')}
            className={`flex-1 py-2.5 rounded-lg ${viewMode === 'expenses' ? 'bg-[#14B8A6]' : ''}`}
          >
            <Text className={`text-center font-semibold text-sm ${viewMode === 'expenses' ? 'text-white' : 'text-slate-400'}`}>
              Expenses
            </Text>
          </Pressable>
        </Animated.View>

        {viewMode === 'income' ? (
          <>
            {/* Export Button */}
            {invoices.length > 0 && (
              <View className="flex-row justify-end mb-4">
                <Pressable
                  onPress={() => { setExportType('invoices'); setShowExportModal(true); }}
                  disabled={exporting}
                  className="active:opacity-70"
                >
                  <Text className="text-[#14B8A6] font-semibold text-sm">
                    {exporting ? 'Exporting…' : 'Export CSV'}
                  </Text>
                </Pressable>
              </View>
            )}

            {/* Filter Tabs */}
            <View className="flex-row bg-[#1E293B] rounded-xl p-1 mb-6">
              {filterOptions.map((option) => (
                <Pressable
                  key={option.key}
                  onPress={() => setFilter(option.key)}
                  className={`flex-1 py-2 rounded-lg ${filter === option.key ? 'bg-[#14B8A6]' : ''}`}
                >
                  <Text className={`text-center font-medium text-sm ${filter === option.key ? 'text-white' : 'text-slate-400'}`}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Invoice List */}
            {filteredInvoices.length === 0 ? (
              <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-8 items-center">
                <FileText size={40} color="#64748B" />
                <Text className="text-slate-500 mt-3">No invoices found</Text>
              </View>
            ) : (
              <View className="gap-3">
                {filteredInvoices.map((invoice) => {
                  const customer = getCustomer(invoice.customerId);
                  const statusColor = getStatusColor(invoice.status);
                  const isLoading = loadingInvoiceId === invoice.id;

                  return (
                    <View
                      key={invoice.id}
                      className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden"
                    >
                      <View className="p-4">
                        <View className="flex-row items-start justify-between mb-3">
                          <View className="flex-1">
                            <Text className="text-white font-bold text-base">
                              {customer?.name || 'Unknown'}
                            </Text>
                            <Text className="text-slate-500 text-xs mt-1">
                              {formatDate(invoice.createdAt)}
                            </Text>
                          </View>
                          <View
                            className="px-3 py-1 rounded-full"
                            style={{ backgroundColor: `${statusColor}20` }}
                          >
                            <Text style={{ color: statusColor }} className="text-xs font-semibold">
                              {getStatusLabel(invoice.status)}
                            </Text>
                          </View>
                        </View>

                        {/* Invoice Breakdown */}
                        <View className="bg-[#0F172A] rounded-xl p-3 mb-3">
                          <View className="flex-row justify-between mb-1">
                            <Text className="text-slate-500 text-sm">Labour</Text>
                            <Text className="text-slate-300 text-sm">
                              £{invoice.quote.labour.toFixed(2)}
                            </Text>
                          </View>
                          <View className="flex-row justify-between mb-1">
                            <Text className="text-slate-500 text-sm">Materials</Text>
                            <Text className="text-slate-300 text-sm">
                              £{invoice.quote.materials.toFixed(2)}
                            </Text>
                          </View>
                          <View className="flex-row justify-between mb-1">
                            <Text className="text-slate-500 text-sm">Travel</Text>
                            <Text className="text-slate-300 text-sm">
                              £{invoice.quote.travel.toFixed(2)}
                            </Text>
                          </View>
                          {invoice.quote.emergencySurcharge > 0 && (
                            <View className="flex-row justify-between mb-1">
                              <Text className="text-slate-500 text-sm">Emergency</Text>
                              <Text className="text-slate-300 text-sm">
                                £{invoice.quote.emergencySurcharge.toFixed(2)}
                              </Text>
                            </View>
                          )}
                          {invoice.quote.vat > 0 && (
                            <View className="flex-row justify-between mb-1">
                              <Text className="text-slate-500 text-sm">VAT</Text>
                              <Text className="text-slate-300 text-sm">
                                £{invoice.quote.vat.toFixed(2)}
                              </Text>
                            </View>
                          )}
                          <View className="border-t border-[#334155] mt-2 pt-2 flex-row justify-between">
                            <Text className="text-white font-bold">Total</Text>
                            <Text className="text-[#14B8A6] font-bold text-lg">
                              £{invoice.quote.total.toFixed(2)}
                            </Text>
                          </View>
                          {invoice.cisDeducted && invoice.cisDeductionAmount && (
                            <View className="flex-row justify-between mt-2 pt-2 border-t border-[#334155]">
                              <Text className="text-slate-500 text-sm">CIS deduction (20%)</Text>
                              <Text className="text-[#F59E0B] text-sm font-medium">
                                −£{invoice.cisDeductionAmount.toFixed(2)}
                              </Text>
                            </View>
                          )}
                        </View>

                        {/* Actions */}
                        {invoice.status === 'pending' && (
                          <Pressable
                            onPress={() => handleSendInvoice(invoice)}
                            disabled={isLoading}
                            className="bg-[#14B8A6] rounded-xl p-3 flex-row items-center justify-center active:opacity-80"
                            style={{ opacity: isLoading ? 0.6 : 1 }}
                          >
                            {isLoading ? (
                              <ActivityIndicator color="#FFF" size="small" />
                            ) : (
                              <>
                                <Send size={18} color="#FFF" />
                                <Text className="text-white font-bold ml-2">Send Invoice</Text>
                              </>
                            )}
                          </Pressable>
                        )}

                        {invoice.status === 'sent' && (
                          <View className="gap-2">
                            <View className="flex-row gap-2">
                              <Pressable
                                onPress={() => handleSendInvoice(invoice)}
                                disabled={isLoading}
                                className="flex-1 bg-[#334155] rounded-xl p-3 flex-row items-center justify-center active:opacity-80"
                                style={{ opacity: isLoading ? 0.6 : 1 }}
                              >
                                {isLoading ? (
                                  <ActivityIndicator color="#F8FAFC" size="small" />
                                ) : (
                                  <>
                                    <Send size={16} color="#F8FAFC" />
                                    <Text className="text-white font-medium ml-2">Resend</Text>
                                  </>
                                )}
                              </Pressable>
                              <Pressable
                                onPress={() => handleCheckPayment(invoice)}
                                disabled={isLoading}
                                className="flex-1 bg-[#8B5CF6] rounded-xl p-3 flex-row items-center justify-center active:opacity-80"
                                style={{ opacity: isLoading ? 0.6 : 1 }}
                              >
                                <RefreshCw size={16} color="#FFF" />
                                <Text className="text-white font-bold ml-2">Check</Text>
                              </Pressable>
                            </View>
                            <Pressable
                              onPress={() => handleMarkPaid(invoice.id)}
                              className="bg-[#14B8A6]/20 border border-[#14B8A6] rounded-xl p-3 flex-row items-center justify-center active:opacity-80"
                            >
                              <CheckCircle size={16} color={TURQUOISE} />
                              <Text className="text-[#14B8A6] font-bold ml-2">Mark as Paid (Manual)</Text>
                            </Pressable>
                          </View>
                        )}

                        {invoice.status === 'paid' && (
                          <View className="items-center py-2 gap-2">
                            {invoice.paidAt && (
                              <View className="flex-row items-center">
                                <CheckCircle size={16} color="#22C55E" />
                                <Text className="text-slate-400 text-sm ml-2">
                                  Paid on {formatDate(invoice.paidAt)}
                                </Text>
                              </View>
                            )}
                            <Pressable
                              onPress={() => handleSharePdf(invoice)}
                              disabled={isLoading}
                              className="active:opacity-70"
                            >
                              <Text className="text-[#14B8A6] font-semibold text-sm">
                                {isLoading ? 'Generating…' : 'Share PDF'}
                              </Text>
                            </Pressable>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        ) : (
          <>
            {/* Expenses View */}
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-slate-400 text-xs">Total Expenses</Text>
                <Text className="text-white font-bold text-lg">£{totals.expenses.toFixed(2)}</Text>
              </View>
              <View className="flex-row items-center gap-3">
                {expenses.length > 0 && (
                  <Pressable
                    onPress={() => { setExportType('expenses'); setShowExportModal(true); }}
                    className="active:opacity-70"
                  >
                    <Text className="text-[#14B8A6] font-semibold text-sm">Export</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => router.push('/add-expense')}
                  className="bg-[#14B8A6] rounded-xl px-4 py-2.5 flex-row items-center active:opacity-80"
                >
                  <Plus size={16} color="#FFF" />
                  <Text className="text-white font-semibold text-sm ml-1.5">Add Expense</Text>
                </Pressable>
              </View>
            </View>

            {sortedExpenses.length === 0 ? (
              <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-8 items-center">
                <Receipt size={40} color="#64748B" />
                <Text className="text-slate-500 mt-3">No expenses recorded</Text>
                <Text className="text-slate-600 text-xs mt-1">Tap "Add Expense" to start tracking</Text>
              </View>
            ) : (
              <View className="gap-3">
                {sortedExpenses.map((expense) => (
                  <View
                    key={expense.id}
                    className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4"
                  >
                    <View className="flex-row items-start justify-between mb-2">
                      <View className="flex-1 mr-3">
                        <Text className="text-white font-semibold text-base">
                          {expense.description}
                        </Text>
                        <Text className="text-slate-500 text-xs mt-1">
                          {formatDate(expense.date)}
                        </Text>
                      </View>
                      <Text className="text-white font-bold text-lg">
                        £{expense.amount.toFixed(2)}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-row items-center">
                        <View className="bg-[#0F172A] rounded-lg px-2.5 py-1">
                          <Text className="text-slate-400 text-xs">
                            {EXPENSE_CATEGORY_LABELS[expense.category]}
                          </Text>
                        </View>
                        {expense.receiptUri && (
                          <View className="bg-[#0F172A] rounded-lg px-2.5 py-1 ml-2">
                            <Text className="text-slate-500 text-xs">Receipt</Text>
                          </View>
                        )}
                        {expense.miles && (
                          <View className="bg-[#0F172A] rounded-lg px-2.5 py-1 ml-2">
                            <Text className="text-slate-500 text-xs">{expense.miles} miles</Text>
                          </View>
                        )}
                      </View>
                      <Pressable
                        onPress={() => handleDeleteExpense(expense.id)}
                        className="p-2 active:opacity-50"
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>

      {/* CIS Deduction Modal */}
      {cisModal && (
        <Pressable
          onPress={() => setCisModal(null)}
          className="absolute inset-0 bg-black/60 justify-end"
        >
          <Pressable onPress={() => {}} className="bg-[#1E293B] rounded-t-2xl border-t border-[#334155] p-4 pb-8">
            <Text className="text-white font-bold text-base mb-4 text-center">Mark as Paid</Text>

            <View className="bg-[#0F172A] rounded-xl p-4 mb-4">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-white font-medium">CIS deducted?</Text>
                <Switch
                  value={cisToggle}
                  onValueChange={setCisToggle}
                  trackColor={{ false: '#334155', true: '#14B8A6' }}
                  thumbColor="#FFF"
                />
              </View>
              {cisToggle && (
                <View className="border-t border-[#334155] pt-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-slate-400 text-sm">Deduction amount</Text>
                    <View className="flex-row items-center bg-[#1E293B] rounded-xl px-3 py-2">
                      <Text className="text-slate-400 mr-1">£</Text>
                      <TextInput
                        className="text-white text-base w-20 text-right"
                        value={cisAmount}
                        onChangeText={setCisAmount}
                        keyboardType="decimal-pad"
                      />
                    </View>
                  </View>
                  <Text className="text-slate-500 text-xs mt-2">
                    Net received: £{(cisModal.total - (parseFloat(cisAmount) || 0)).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={() => confirmMarkPaid(cisModal.invoiceId, cisToggle, parseFloat(cisAmount) || 0)}
              className="bg-[#14B8A6] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
            >
              <CheckCircle size={18} color="#FFF" />
              <Text className="text-white font-bold ml-2">Confirm Payment</Text>
            </Pressable>

            <Pressable
              onPress={() => setCisModal(null)}
              className="mt-3 p-3 active:opacity-70"
            >
              <Text className="text-slate-400 font-medium text-center">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <Pressable
          onPress={() => setShowExportModal(false)}
          className="absolute inset-0 bg-black/60 justify-end"
        >
          <Pressable onPress={() => {}} className="bg-[#1E293B] rounded-t-2xl border-t border-[#334155] p-4 pb-8">
            <Text className="text-white font-bold text-base mb-4 text-center">Export</Text>

            {/* Export type selector */}
            <View className="flex-row bg-[#0F172A] rounded-xl p-1 mb-4">
              {([
                { key: 'invoices' as const, label: 'Invoices' },
                { key: 'expenses' as const, label: 'Expenses' },
                { key: 'tax_summary' as const, label: 'Tax Summary' },
              ]).map((opt) => (
                <Pressable
                  key={opt.key}
                  onPress={() => setExportType(opt.key)}
                  className={`flex-1 py-2 rounded-lg ${exportType === opt.key ? 'bg-[#14B8A6]' : ''}`}
                >
                  <Text className={`text-center text-xs font-medium ${exportType === opt.key ? 'text-white' : 'text-slate-400'}`}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Date range */}
            <Text className="text-slate-400 text-xs mb-2">Date range</Text>
            <View className="gap-2">
              {DATE_PRESETS.map((preset) => (
                <Pressable
                  key={preset}
                  onPress={() => handleExportCsv(preset)}
                  className="bg-[#0F172A] rounded-xl p-4 active:opacity-80"
                >
                  <Text className="text-white font-medium text-center">
                    {getPresetLabel(preset)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setShowExportModal(false)}
              className="mt-3 p-3 active:opacity-70"
            >
              <Text className="text-slate-400 font-medium text-center">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {modal && (
        <ConfirmModal
          visible={!!modal}
          title={modal.title}
          message={modal.message}
          variant={modal.variant}
          onDismiss={() => setModal(null)}
        />
      )}
    </>
  );
}
