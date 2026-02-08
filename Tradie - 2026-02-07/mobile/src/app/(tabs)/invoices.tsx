import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Share,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  FileText,
  CheckCircle,
  Send,
  AlertCircle,
  RefreshCw,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTradeStore, useInvoices, useSettings, Invoice } from '@/lib/store';
import { sendPaymentReceivedNotification } from '@/lib/notifications';
import { paymentsApi } from '@/lib/paymentsApi';

const TURQUOISE = '#14B8A6';

type FilterType = 'all' | 'pending' | 'sent' | 'paid';

export default function InvoicesScreen() {
  const router = useRouter();
  const invoices = useInvoices();
  const settings = useSettings();
  const { getCustomer, updateInvoice, getJob } = useTradeStore();

  const [filter, setFilter] = useState<FilterType>('all');
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    if (filter === 'all') return invoices;
    return invoices.filter((inv) => inv.status === filter);
  }, [invoices, filter]);

  // Calculate totals
  const totals = useMemo(() => {
    const pending = invoices
      .filter((inv) => inv.status === 'pending' || inv.status === 'sent')
      .reduce((sum, inv) => sum + inv.quote.total, 0);
    const paid = invoices
      .filter((inv) => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.quote.total, 0);
    return { pending, paid };
  }, [invoices]);

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
      Alert.alert('Error', 'Customer not found');
      return;
    }

    setLoadingInvoiceId(invoice.id);

    try {
      // Get or create payment link from backend
      let paymentLink = invoice.stripePaymentLink;

      // Generate user ID for Stripe Connect
      const userId = `user_${settings.businessName.replace(/\s/g, '_')}_${settings.phone.replace(/\s/g, '')}` || 'default_user';

      if (!paymentLink) {
        // Create invoice in backend with Stripe
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
          userId: userId, // For Stripe Connect - payments go to trader's account
        });

        if (!result.success || !result.paymentLink) {
          throw new Error(result.error || 'Failed to create payment link');
        }

        paymentLink = result.paymentLink;

        // Save payment link to local store
        updateInvoice(invoice.id, {
          stripePaymentLink: paymentLink,
        });
      }

      // Share the payment link
      await Share.share({
        message: `Hi ${customer.name},\n\nPlease find your invoice for £${invoice.quote.total.toFixed(2)} from ${settings.businessName || 'TRADIE'}.\n\nPay securely here: ${paymentLink}\n\nThank you for your business!`,
        title: `Invoice from ${settings.businessName || 'TRADIE'}`,
      });

      // Mark as sent in backend and locally
      await paymentsApi.markInvoiceSent(invoice.id);
      updateInvoice(invoice.id, {
        status: 'sent',
        sentAt: new Date().toISOString(),
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error sending invoice:', error);
      Alert.alert(
        'Error',
        'Failed to create payment link. Please check your internet connection and try again.'
      );
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleCheckPayment = async (invoice: Invoice) => {
    setLoadingInvoiceId(invoice.id);

    try {
      const result = await paymentsApi.checkPaymentStatus(invoice.id);

      if (result.success && result.status === 'paid') {
        const customer = getCustomer(invoice.customerId);

        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        updateInvoice(invoice.id, {
          status: 'paid',
          paidAt: result.paidAt || new Date().toISOString(),
        });

        if (customer) {
          await sendPaymentReceivedNotification(customer.name, invoice.quote.total);
        }

        Alert.alert('Payment Received!', `£${invoice.quote.total.toFixed(2)} has been paid.`);
      } else {
        Alert.alert('Payment Pending', 'This invoice has not been paid yet.');
      }
    } catch (error) {
      console.error('Error checking payment:', error);
      Alert.alert('Error', 'Failed to check payment status.');
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const handleMarkPaid = async (invoiceId: string) => {
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    const customer = invoice ? getCustomer(invoice.customerId) : null;

    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateInvoice(invoiceId, {
      status: 'paid',
      paidAt: new Date().toISOString(),
    });

    // Send payment notification
    if (customer && invoice) {
      await sendPaymentReceivedNotification(customer.name, invoice.quote.total);
    }
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
      case 'pending':
        return '#F59E0B';
      case 'sent':
        return '#8B5CF6';
      case 'paid':
        return '#22C55E';
      default:
        return '#64748B';
    }
  };

  const getStatusLabel = (status: Invoice['status']) => {
    switch (status) {
      case 'pending':
        return 'Draft';
      case 'sent':
        return 'Sent';
      case 'paid':
        return 'Paid';
      default:
        return status;
    }
  };

  const filterOptions: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Draft' },
    { key: 'sent', label: 'Sent' },
    { key: 'paid', label: 'Paid' },
  ];

  return (
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

        {/* Filter Tabs */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          className="flex-row bg-[#1E293B] rounded-xl p-1 mb-6"
        >
          {filterOptions.map((option) => (
            <Pressable
              key={option.key}
              onPress={() => setFilter(option.key)}
              className={`flex-1 py-2 rounded-lg ${
                filter === option.key ? 'bg-[#14B8A6]' : ''
              }`}
            >
              <Text
                className={`text-center font-medium text-sm ${
                  filter === option.key ? 'text-white' : 'text-slate-400'
                }`}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </Animated.View>

        {/* Invoice List */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
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
                        <View className="flex-row justify-between mb-1">
                          <Text className="text-slate-500 text-sm">VAT</Text>
                          <Text className="text-slate-300 text-sm">
                            £{invoice.quote.vat.toFixed(2)}
                          </Text>
                        </View>
                        <View className="border-t border-[#334155] mt-2 pt-2 flex-row justify-between">
                          <Text className="text-white font-bold">Total</Text>
                          <Text className="text-[#14B8A6] font-bold text-lg">
                            £{invoice.quote.total.toFixed(2)}
                          </Text>
                        </View>
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

                      {invoice.status === 'paid' && invoice.paidAt && (
                        <View className="flex-row items-center justify-center py-2">
                          <CheckCircle size={16} color="#22C55E" />
                          <Text className="text-slate-400 text-sm ml-2">
                            Paid on {formatDate(invoice.paidAt)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </View>
    </ScrollView>
  );
}
