/**
 * Full-screen preview of the exact invoice or quote PDF the customer will get,
 * with Edit (while it can still change) and Send. Opened as
 * /preview?kind=invoice&id=<invoiceId> or /preview?kind=quote&id=<jobId>.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { useTradeStore, useSettings, invoiceNumberLabel, type BusinessSettings } from '@/lib/store';
import { createInvoicePdf, createQuotePdf, sharePdfFile } from '@/lib/invoiceExport';
import { useBusinessDetailsPrompt } from '@/components/BusinessDetailsPrompt';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useInvoiceShareGate } from '@/components/useInvoiceShareGate';
import { PrimaryButton, ModalHeader } from '@/components/ui';
import { toast } from '@/components/Toast';
import { useTheme } from '@/lib/theme';
import { track } from '@/lib/analytics';

type Kind = 'invoice' | 'quote';

export default function PreviewScreen() {
  const { kind, id } = useLocalSearchParams<{ kind: Kind; id: string }>();
  const router = useRouter();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const settings = useSettings();
  const invoice = useTradeStore((s) => (kind === 'invoice' ? s.invoices.find((i) => i.id === id) : undefined));
  const job = useTradeStore((s) => s.jobs.find((j) => j.id === (kind === 'invoice' ? invoice?.jobId : id)));
  const customer = useTradeStore((s) => (job ? s.customers.find((c) => c.id === job.customerId) : undefined));
  const hasInvoice = useTradeStore((s) => (job ? s.invoices.some((i) => i.jobId === job.id) : false));
  const updateInvoice = useTradeStore((s) => s.updateInvoice);
  const updateJob = useTradeStore((s) => s.updateJob);
  const { requireDetails, prompt } = useBusinessDetailsPrompt();
  const [askSent, setAskSent] = useState(false);
  const [sending, setSending] = useState(false);
  const { checkShare, shareInvoice, limitPrompt } = useInvoiceShareGate();

  const quote = kind === 'invoice' ? invoice?.quote : job?.quote;
  // Paid invoices are final; a quote stops changing once it's on an invoice.
  const editable = kind === 'invoice' ? !!invoice && invoice.status !== 'paid' : !!job?.quote && !hasInvoice;

  // The PDF is rebuilt whenever anything printed on it changes.
  const pdf = useQuery({
    queryKey: ['preview-pdf', kind, id, invoice, job, customer, settings],
    queryFn: () =>
      kind === 'invoice'
        ? createInvoicePdf({ invoice: invoice!, job: job!, customer: customer!, settings })
        : createQuotePdf({ job: job!, customer: customer!, settings }),
    enabled: Platform.OS !== 'web' && !!job && !!customer && !!quote && (kind === 'quote' || !!invoice),
    gcTime: 0,
  });

  if (!job || !customer || !quote) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-secondary text-base text-center mb-4">This document isn’t available any more.</Text>
        <PrimaryButton label="Close" onPress={goBack} />
      </View>
    );
  }

  const title = kind === 'invoice' && invoice ? invoiceNumberLabel(invoice) : 'Quote';
  const sendLabel =
    kind === 'invoice'
      ? invoice?.status === 'paid'
        ? 'Share invoice'
        : invoice?.status === 'sent'
          ? 'Send again'
          : 'Send invoice'
      : job.quoteSentAt
        ? 'Send again'
        : 'Send quote';

  const send = async () => {
    // Free plan: checked before the business details are asked for, so nobody fills them in for nothing.
    if (kind === 'invoice' && invoice && !(await checkShare(invoice))) return;
    requireDetails(kind, async (current: BusinessSettings) => {
      setSending(true);
      try {
        if (kind === 'invoice' && invoice) {
          const uri = await createInvoicePdf({ invoice, job, customer, settings: current });
          if (!(await shareInvoice(invoice, () => sharePdfFile(uri)))) return;
        } else {
          await sharePdfFile(await createQuotePdf({ job, customer, settings: current }));
        }
        // Only ask when this send would change something (first send of an invoice or quote).
        if ((kind === 'invoice' && invoice?.status === 'pending') || (kind === 'quote' && !job.quoteSentAt)) setAskSent(true);
      } finally {
        setSending(false);
      }
    });
  };

  const edit = () => router.push(kind === 'invoice' && invoice ? `/price?kind=invoice&id=${invoice.id}` : `/price?kind=quote&id=${job.id}`);

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <ModalHeader
        title={title}
        onClose={goBack}
        left={
          editable ? (
            <Pressable
              onPress={edit}
              hitSlop={10}
              className="min-h-[44px] justify-center"
              accessibilityRole="button"
            >
              <Text className="text-link text-[17px] font-semibold">Edit</Text>
            </Pressable>
          ) : undefined
        }
      />

      {/* The document, exactly as the customer sees it */}
      <View className="flex-1 mx-4 mt-2 mb-3 rounded-2xl overflow-hidden bg-surface">
        {Platform.OS === 'web' ? (
          <View className="flex-1 items-center justify-center p-6">
            <Text className="text-secondary text-center">The PDF preview shows on iPhone.</Text>
          </View>
        ) : pdf.data ? (
          <WebView
            source={{ uri: pdf.data }}
            originWhitelist={['*']}
            allowFileAccess
            allowingReadAccessToURL={FileSystem.cacheDirectory ?? undefined}
            style={{ backgroundColor: 'transparent' }}
          />
        ) : pdf.isError ? (
          <View className="flex-1 items-center justify-center p-6">
            <Text className="text-secondary text-center mb-3">Couldn’t make the PDF.</Text>
            <Pressable onPress={() => pdf.refetch()} hitSlop={10} accessibilityRole="button">
              <Text className="text-link font-semibold">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={t.link} />
          </View>
        )}
      </View>

      <View className="px-4" style={{ paddingBottom: insets.bottom + 12 }}>
        <PrimaryButton label={sendLabel} onPress={send} loading={sending} />
      </View>

      <ConfirmModal
        visible={askSent}
        title="Did you send it?"
        message={`Mark the ${kind} to ${customer.name} as sent?${kind === 'invoice' ? ' Its due date starts today.' : ''}`}
        confirmText="Yes, mark as sent"
        cancelText="Not yet"
        onConfirm={() => {
          toast(`${kind === 'invoice' ? 'Invoice' : 'Quote'} marked as sent`);
          track(kind === 'invoice' ? 'invoice_sent' : 'quote_sent');
          if (kind === 'invoice' && invoice) updateInvoice(invoice.id, { status: 'sent', sentAt: new Date().toISOString() });
          if (kind === 'quote')
            updateJob(job.id, {
              quoteSentAt: new Date().toISOString(),
              ...(job.status === 'REQUESTED' && { status: 'QUOTED' as const }),
            });
        }}
        onCancel={() => {}}
        onDismiss={() => setAskSent(false)}
      />
      {limitPrompt}
      {prompt}
    </View>
  );
}
