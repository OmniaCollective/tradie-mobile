/**
 * Full-screen preview of the exact invoice or quote PDF the customer will get,
 * with Edit (while it can still change) and Send. Opened as
 * /preview?kind=invoice&id=<invoiceId> or /preview?kind=quote&id=<jobId>.
 */
import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Platform, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import { useTradeStore, useSettings, invoiceNumberLabel, priceQuote, type BusinessSettings } from '@/lib/store';
import { createInvoicePdf, createQuotePdf, sharePdfFile } from '@/lib/invoiceExport';
import { useBusinessDetailsPrompt } from '@/components/BusinessDetailsPrompt';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Group, RowDivider, PrimaryButton, Sheet, NumberFieldRow } from '@/components/ui';
import { formatMoney, currencySymbol } from '@/lib/money';
import { useTheme } from '@/lib/theme';

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
  const updateInvoicePrices = useTradeStore((s) => s.updateInvoicePrices);
  const updateQuote = useTradeStore((s) => s.updateQuote);
  const updateJob = useTradeStore((s) => s.updateJob);
  const { requireDetails, prompt } = useBusinessDetailsPrompt();
  const [edit, setEdit] = useState<{ labour: number; materials: number; travel: number; description: string } | null>(null);
  const [askSent, setAskSent] = useState(false);
  const [sending, setSending] = useState(false);

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

  const send = () =>
    requireDetails(kind, async (current: BusinessSettings) => {
      setSending(true);
      try {
        const uri =
          kind === 'invoice'
            ? await createInvoicePdf({ invoice: invoice!, job, customer, settings: current })
            : await createQuotePdf({ job, customer, settings: current });
        await sharePdfFile(uri);
        // Only ask when this send would change something (first send of an invoice or quote).
        if ((kind === 'invoice' && invoice?.status === 'pending') || (kind === 'quote' && !job.quoteSentAt)) setAskSent(true);
      } finally {
        setSending(false);
      }
    });

  const saveEdit = async () => {
    if (!edit) return;
    const prices = { labour: edit.labour, materials: edit.materials, travel: edit.travel };
    if (kind === 'invoice' && invoice) updateInvoicePrices(invoice.id, prices);
    else updateQuote(job.id, prices);
    updateJob(job.id, { description: edit.description.trim() });
    setEdit(null);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-4"
        style={{ paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8 }}
      >
        <Pressable onPress={goBack} hitSlop={10} className="min-h-[44px] justify-center min-w-[56px]" accessibilityRole="button">
          <Text className="text-link text-[17px]">Close</Text>
        </Pressable>
        <Text className="text-fg text-[17px] font-semibold">{title}</Text>
        <View className="min-w-[56px] items-end">
          {editable && (
            <Pressable
              onPress={() =>
                setEdit({
                  labour: quote.labour,
                  materials: quote.materials,
                  travel: quote.travel,
                  description: job.description ?? '',
                })
              }
              hitSlop={10}
              className="min-h-[44px] justify-center"
              accessibilityRole="button"
            >
              <Text className="text-link text-[17px] font-semibold">Edit</Text>
            </Pressable>
          )}
        </View>
      </View>

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

      {/* Edit the amounts and description */}
      {edit && (
        <Sheet visible onClose={() => setEdit(null)}>
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ maxHeight: 620 }}>
            <Text className="text-fg text-[20px] font-semibold mb-4">Edit {kind}</Text>
            <Group className="bg-bg mb-4">
              <NumberFieldRow
                label="Labour"
                prefix={currencySymbol()}
                value={edit.labour}
                onChangeNumber={(n) => setEdit({ ...edit, labour: n })}
                width="w-24"
              />
              <RowDivider />
              <NumberFieldRow
                label="Materials"
                prefix={currencySymbol()}
                value={edit.materials}
                onChangeNumber={(n) => setEdit({ ...edit, materials: n })}
                width="w-24"
              />
              <RowDivider />
              <NumberFieldRow
                label="Travel"
                prefix={currencySymbol()}
                value={edit.travel}
                onChangeNumber={(n) => setEdit({ ...edit, travel: n })}
                width="w-24"
              />
            </Group>
            <Text className="text-secondary text-[13px] mx-1 mb-1.5">Description of the work</Text>
            <Group className="bg-bg mb-3">
              <TextInput
                className="text-fg text-base px-4 py-3 min-h-[72px]"
                style={{ textAlignVertical: 'top' }}
                value={edit.description}
                onChangeText={(v) => setEdit({ ...edit, description: v })}
                placeholder="Optional"
                placeholderTextColor={t.secondary}
                multiline
                accessibilityLabel="Description of the work"
              />
            </Group>
            <Text className="text-fg text-base font-semibold mx-1 mb-1">
              Total {formatMoney(priceQuote(settings, edit, quote.emergencySurcharge).total)}
            </Text>
            {kind === 'invoice' && invoice?.status === 'sent' && (
              <Text className="text-secondary text-[13px] mx-1 mb-1">
                You’ve already sent this invoice. After saving, use Send again so the customer has the corrected one.
              </Text>
            )}
            <PrimaryButton label="Save" onPress={saveEdit} className="mt-3" />
            <Pressable
              onPress={() => setEdit(null)}
              className="min-h-[48px] items-center justify-center mt-1"
              accessibilityRole="button"
            >
              <Text className="text-secondary text-base font-semibold">Cancel</Text>
            </Pressable>
          </ScrollView>
        </Sheet>
      )}

      <ConfirmModal
        visible={askSent}
        title="Did you send it?"
        message={`Mark the ${kind} to ${customer.name} as sent?${kind === 'invoice' ? ' Its due date starts today.' : ''}`}
        confirmText="Yes, mark as sent"
        cancelText="Not yet"
        onConfirm={() => {
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
      {prompt}
    </View>
  );
}
