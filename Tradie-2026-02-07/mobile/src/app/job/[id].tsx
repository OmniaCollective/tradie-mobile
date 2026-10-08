/**
 * A job. Opens and closes freely (X); nothing changes by opening it. Its checklist (Quote →
 * Booked → Job done → Invoice → Paid) lets any step be done in any order, each saving as it's
 * done and each undoable; the next one is highlighted, never forced. Agreed design:
 * release/ux-journey-review.md.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Linking, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Phone,
  MessageCircle,
  Navigation,
  Calendar,
  CalendarPlus,
  CalendarClock,
  CalendarX,
  Bell,
  Plus,
  Trash2,
  CircleAlert,
  CircleCheck,
  Circle,
  CircleX,
  Clock,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as SMS from 'expo-sms';
import {
  useTradeStore,
  useJobExpenses,
  EXPENSE_CATEGORY_LABELS,
  getRegion,
  businessDisplayName,
  priceQuote,
  usePricingPresets,
  type JobType,
  type Urgency,
  type OfferedSlot,
  jobName,
} from '@/lib/store';
import { jobPosition, type StepKey } from '@/lib/jobSteps';
import { whereText, ago, daysToPay } from '@/lib/jobText';
import { syncJobToCalendar, requestCalendarPermissions, hasCalendarPermissions, removeJobFromCalendar } from '@/lib/calendarSync';
import { cancelJobReminder } from '@/lib/notifications';
import { activeOffer, offerExpired, formatSlot, slotDate, scheduleJob, confirmationMessage } from '@/lib/booking';
import { chaseInvoice, remindAboutQuote } from '@/lib/chase';
import { useBusinessDetailsPrompt } from '@/components/BusinessDetailsPrompt';
import { sendCustomerReminder } from '@/lib/customerReminders';
import { ConfirmModal } from '@/components/ConfirmModal';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { Tip } from '@/components/Tip';
import { formatDateFull, formatTime, toDateKey } from '@/lib/dates';
import { formatAmount, currencySymbol } from '@/lib/money';
import { useProAccess } from '@/lib/useProAccess';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import {
  Group,
  RowDivider,
  SectionHeader,
  PrimaryButton,
  Segmented,
  LinkRow,
  Sheet,
  NumberFieldRow,
  FieldRow,
  ChoiceRow,
  LabeledField,
} from '@/components/ui';
import { toast } from '@/components/Toast';
import { track } from '@/lib/analytics';

const makePhotoFileName = () => `photo_${Date.now()}.jpg`;
const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row justify-between py-1">
      <Text className={strong ? 'text-fg text-base font-semibold' : 'text-secondary text-[15px]'}>{label}</Text>
      <Text className={strong ? 'text-fg text-[17px] font-bold' : 'text-fg text-[15px]'}>{value}</Text>
    </View>
  );
}

/** One checklist step: its state, what happened, and what you can do now. */
interface Step {
  key: StepKey;
  label: string;
  note: string;
  noteAlert?: boolean;
  state: 'done' | 'half' | 'todo';
  action?: { label: string; run: () => void };
  undo?: () => void;
  extra?: React.ReactNode;
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Opened from a link or notification there may be nothing to go back to; then go Home.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const t = useTheme();
  const job = useTradeStore((s) => s.jobs.find((j) => j.id === id));
  const customer = useTradeStore((s) => (job ? s.customers.find((c) => c.id === job.customerId) : undefined));
  const invoice = useTradeStore((s) => s.invoices.find((inv) => inv.jobId === id));
  const settings = useTradeStore((s) => s.settings);
  const { requireDetails, prompt: detailsPrompt } = useBusinessDetailsPrompt();
  const store = useTradeStore.getState;
  const updateJob = useTradeStore((s) => s.updateJob);
  const updateQuote = useTradeStore((s) => s.updateQuote);
  const jobExpenses = useJobExpenses(id);
  const pricingPresets = usePricingPresets();
  const { isPro, canCreateInvoice, invoicesLeft } = useProAccess();

  const [modal, setModal] = useState<{
    title: string;
    message: string;
    variant?: 'default' | 'success' | 'error' | 'warning';
  } | null>(null);
  const [addingPart, setAddingPart] = useState(false);
  const [partName, setPartName] = useState('');
  const [partQty, setPartQty] = useState('');
  const [partCost, setPartCost] = useState('');
  const [showBook, setShowBook] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [editQuote, setEditQuote] = useState<{ labour: number; materials: number; travel: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnbook, setConfirmUnbook] = useState(false);
  const [editJob, setEditJob] = useState<{ type: JobType; customName: string; description: string; urgency: Urgency } | null>(
    null,
  );
  const calculateQuote = useTradeStore((s) => s.calculateQuote);
  const [editCustomer, setEditCustomer] = useState<{
    name: string;
    phone: string;
    email: string;
    address: string;
    postcode: string;
  } | null>(null);
  const [limitPrompt, setLimitPrompt] = useState(false);

  if (!job || !customer) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Stack.Screen options={{ title: 'Job' }} />
        <Text className="text-secondary text-base text-center">This job no longer exists.</Text>
      </View>
    );
  }

  const now = new Date();
  const terms = settings.paymentTermsDays ?? 14;
  const p = jobPosition(job, invoice, terms, now);
  const f = p.facts;
  const first = customer.name.trim().split(/\s+/)[0] || customer.name;
  const label = jobName(job, settings.trade);
  const parts = job.parts ?? [];
  const partsTotal = parts.reduce((s, x) => s + x.quantity * x.unitCost, 0);
  const expensesTotal = jobExpenses.reduce((s, e) => s + e.amount, 0);
  const photos = job.photos ?? [];
  const offers = activeOffer(job);
  const expired = offerExpired(job);
  // The price can change until it's on an invoice.
  const quoteEditable = !invoice;
  const status = whereText(job, invoice, p, first, terms, now);
  const firstNoteLine = job.notes
    ?.split('\n')
    .find((l) => l.trim())
    ?.trim();

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (result.canceled || !result.assets[0]) return;
    const destDir = `${FileSystem.documentDirectory}job-photos/`;
    await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
    const destUri = `${destDir}${makePhotoFileName()}`;
    await FileSystem.copyAsync({ from: result.assets[0].uri, to: destUri });
    store().addPhoto(job.id, { uri: destUri, createdAt: new Date().toISOString() });
    toast('Photo added');
  };

  const handleDeletePhoto = async (photoId: string, uri: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    store().removePhoto(job.id, photoId);
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {}
  };

  const confirmSchedule = async () => {
    setShowSchedule(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await scheduleJob(job, customer, scheduleDate);
    toast('Booked · counts as a yes');
  };

  /** The customer picked one of the offered times: book it and send a confirmation. */
  const bookOffered = async (slot: OfferedSlot) => {
    const when = slotDate(slot);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await scheduleJob(job, customer, when);
    toast(`Booked · ${formatSlot(when)}`);
    // The job is booked either way; the confirmation text is signed, so it waits for a name.
    if (customer.phone && Platform.OS !== 'web' && (await SMS.isAvailableAsync())) {
      requireDetails('message', async () => {
        await SMS.sendSMSAsync([customer.phone], confirmationMessage(customer, when));
      });
    }
  };

  const openSuggest = () => {
    setShowBook(false);
    router.push(`/suggest-times?jobId=${job.id}`);
  };
  const openPicker = () => {
    setShowBook(false);
    // Changing a booked time starts from the current one.
    if (job.scheduledDate) setScheduleDate(slotDate({ date: job.scheduledDate, time: job.scheduledTime || '09:00' }));
    setPickerMode('date');
    setShowSchedule(true);
  };

  const unbook = async () => {
    await cancelJobReminder(job.id);
    await removeJobFromCalendar(job.id);
    store().unbook(job.id);
    toast(f.booked ? 'Booking removed' : 'Offered times cancelled');
  };

  const handleAddToCalendar = async () => {
    setShowBook(false);
    try {
      const allowed = (await hasCalendarPermissions()) || (await requestCalendarPermissions());
      if (!allowed) {
        setModal({
          title: 'Calendar access needed',
          message: 'Allow Tradie to use your calendar in the iPhone Settings app.',
          variant: 'warning',
        });
        return;
      }
      if (await syncJobToCalendar(job, customer, label)) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast('Added to your calendar');
      } else {
        setModal({ title: 'Couldn’t add it', message: 'Please try again.', variant: 'error' });
      }
    } catch (error) {
      if (__DEV__) console.error('Calendar sync error:', error);
      setModal({ title: 'Couldn’t add it', message: 'Please try again.', variant: 'error' });
    }
  };

  // The visit reminder to the customer is signed, so it asks for business details first.
  const handleRemindVisit = () => {
    setShowBook(false);
    requireDetails('message', async (current) => {
      const type = job.scheduledDate === toDateKey() ? 'morning_of' : 'day_before';
      if (await sendCustomerReminder(customer, job, label, businessDisplayName(current), type)) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    });
  };

  const openQuote = () => router.push(`/preview?kind=quote&id=${job.id}`);

  const sendInvoice = async () => {
    if (invoice) {
      router.push(`/preview?kind=invoice&id=${invoice.id}`);
      return;
    }
    if (!canCreateInvoice) {
      setLimitPrompt(true);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newId = store().createInvoice(job.id);
    if (newId) router.push(`/preview?kind=invoice&id=${newId}`);
  };

  const markPaid = async () => {
    if (!job.quote && !invoice) return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    store().markPaid(job.id, true);
    toast('Marked as paid');
    track('marked_paid');
  };

  const nudge = async () => {
    if (p.nudge === 'chase' && invoice) {
      if (await chaseInvoice(invoice, job, customer, settings)) toast('Reminder sent');
    } else if (await remindAboutQuote(job, customer, label, settings)) {
      toast('Reminder sent');
    }
  };

  const savePart = () => {
    const qty = parseInt(partQty || '1', 10);
    const cost = parseFloat(partCost.replace(',', '.'));
    if (!partName.trim() || !(qty > 0) || !(cost > 0)) return;
    store().addPart(job.id, { name: partName.trim(), quantity: qty, unitCost: cost });
    toast('Part added');
    cancelPart();
  };
  const cancelPart = () => {
    setPartName('');
    setPartQty('');
    setPartCost('');
    setAddingPart(false);
  };

  // ── The checklist ──────────────────────────────────────────────────────────

  const freeNote = !isPro && Number.isFinite(invoicesLeft) && !invoice ? ` · ${invoicesLeft} free this month` : '';
  const steps: Step[] = [
    {
      key: 'quote',
      label: 'Quote',
      state: f.quoteSent || f.accepted ? 'done' : 'todo',
      note: f.quoteSent
        ? `Sent ${ago(job.quoteSentAt!)}` + (f.accepted ? ' · accepted' : '')
        : f.accepted
          ? 'Agreed without a quote'
          : 'Ready to send',
      action:
        p.nudge === 'remind'
          ? { label: 'Remind', run: nudge }
          : f.quoteSent || f.accepted
            ? { label: 'View', run: openQuote }
            : { label: 'Send', run: openQuote },
      undo:
        f.quoteSent && !f.accepted ? () => (store().markQuoteSent(job.id, false), toast('Quote marked as not sent')) : undefined,
    },
    {
      key: 'book',
      label: 'Booked',
      state: f.booked ? 'done' : f.offered ? 'half' : 'todo',
      note: f.booked
        ? `${formatDateFull(job.scheduledDate!)} · ${formatTime(job.scheduledTime)}`
        : offers.length
          ? `Times sent to ${first} · tap the one they picked`
          : expired
            ? 'The times you offered have expired'
            : f.accepted
              ? `${first} said yes · needs a time`
              : 'No time yet',
      action: { label: f.booked || offers.length ? 'Change' : 'Book', run: () => setShowBook(true) },
      extra:
        !f.booked && offers.length > 0 ? (
          <View className="mt-2 gap-1.5">
            {offers.map((slot) => (
              <Pressable
                key={`${slot.date}T${slot.time}`}
                onPress={() => bookOffered(slot)}
                className="bg-bg rounded-xl px-3 min-h-[44px] justify-center active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel={`Book ${formatSlot(slotDate(slot))}`}
              >
                <Text className="text-fg text-[15px]">{formatSlot(slotDate(slot))}</Text>
              </Pressable>
            ))}
          </View>
        ) : null,
    },
    {
      key: 'done',
      label: 'Job done',
      state: f.done ? 'done' : 'todo',
      note: f.done ? `Finished ${ago(job.completedAt!)}` : 'Mark it when the work’s finished',
      action: f.done
        ? undefined
        : {
            label: 'Mark done',
            run: async () => {
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              store().markDone(job.id, true);
              toast('Marked as done');
            },
          },
      undo: f.done && !f.invoiceSent ? () => (store().markDone(job.id, false), toast('Marked as not done')) : undefined,
    },
    {
      key: 'invoice',
      label: 'Invoice',
      state: f.invoiceSent ? 'done' : 'todo',
      noteAlert: p.overdueDays > 0,
      note: invoice?.recordedOnly
        ? 'Paid on the day, no invoice sent'
        : f.invoiceSent
          ? p.overdueDays > 0
            ? `${p.overdueDays} ${p.overdueDays === 1 ? 'day' : 'days'} overdue`
            : f.paid
              ? `Sent ${ago(invoice!.sentAt!)}`
              : `Sent ${ago(invoice!.sentAt!)} · due in ${daysToPay(invoice!, terms, now)} days`
          : invoice
            ? 'Made, not sent yet'
            : `Not sent yet${freeNote}`,
      action: invoice?.recordedOnly
        ? undefined
        : p.nudge === 'chase'
          ? { label: 'Chase', run: nudge }
          : f.invoiceSent
            ? { label: 'View', run: sendInvoice }
            : { label: 'Send', run: sendInvoice },
      undo:
        f.invoiceSent && !f.paid && invoice
          ? () => (
              store().updateInvoice(invoice.id, { status: 'pending', sentAt: undefined }),
              toast('Invoice marked as not sent')
            )
          : undefined,
    },
    {
      key: 'paid',
      label: 'Paid',
      state: f.paid ? 'done' : 'todo',
      note: f.paid ? `Paid ${invoice?.paidAt ? ago(invoice.paidAt) : ''}`.trim() : 'Mark it when the money’s in',
      action: f.paid
        ? invoice
          ? { label: 'Send receipt', run: () => router.push(`/preview?kind=invoice&id=${invoice.id}`) }
          : undefined
        : { label: 'Mark paid', run: markPaid },
      undo: f.paid ? () => (store().markPaid(job.id, false), toast('Marked as unpaid')) : undefined,
    },
  ];

  // ── Screen ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ title: 'Job' }} />
      <ScrollView
        className="flex-1 bg-bg"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 }}
      >
        {/* Where it is, what it is */}
        <View className="mb-5">
          <Text
            className={cn(
              'text-sm font-semibold mb-1',
              p.overdueDays > 0 ? 'text-alert' : f.paid ? 'text-link' : 'text-secondary',
            )}
          >
            {status}
          </Text>
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 text-fg text-[28px] font-bold tracking-tight mr-3" accessibilityRole="header">
              {label}
            </Text>
            <Pressable
              onPress={() =>
                setEditJob({
                  type: job.type,
                  customName: job.customName ?? '',
                  description: job.description ?? '',
                  urgency: job.urgency,
                })
              }
              hitSlop={10}
              className="min-h-[44px] justify-center"
              accessibilityRole="button"
              accessibilityLabel="Edit job"
            >
              <Text className="text-link text-[15px] font-semibold">Edit</Text>
            </Pressable>
          </View>
          <Text className="text-secondary text-base">
            {job.quote ? formatAmount(job.quote.total) : ''}
            {job.urgency !== 'standard' ? ` · ${job.urgency === 'urgent' ? 'Urgent' : 'Emergency'}` : ''}
          </Text>
          {job.description && job.description !== label ? (
            <Text className="text-secondary text-base leading-6 mt-1">{job.description}</Text>
          ) : null}
          {firstNoteLine ? (
            <Text className="text-secondary text-sm mt-1.5" numberOfLines={1}>
              Note: {firstNoteLine}
            </Text>
          ) : null}
        </View>

        <Tip
          id="job"
          text="This is the job’s checklist. Do any step, in any order. Everything saves as you go."
          className="mb-5"
        />

        {/* Customer */}
        <Group className="mb-6">
          <View className="px-4 pt-4 pb-3 flex-row items-start justify-between">
            <View className="flex-1 mr-3">
              <Pressable
                onPress={() => router.push(`/customer/${customer.id}`)}
                className="self-start min-h-[28px] justify-center"
                accessibilityRole="button"
                accessibilityHint="Opens everything for this customer"
              >
                <Text className="text-fg text-[17px] font-semibold">{customer.name}</Text>
              </Pressable>
              {!!(customer.address || customer.postcode) && (
                <Text className="text-secondary text-[15px] mt-0.5">
                  {[customer.address, customer.postcode].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
            <Pressable
              onPress={() =>
                setEditCustomer({
                  name: customer.name,
                  phone: customer.phone ?? '',
                  email: customer.email ?? '',
                  address: customer.address ?? '',
                  postcode: customer.postcode ?? '',
                })
              }
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Edit customer"
            >
              <Text className="text-link text-[15px] font-semibold">Edit</Text>
            </Pressable>
          </View>
          <View className="flex-row border-t border-divider">
            {[
              { icon: Phone, text: 'Call', run: () => Linking.openURL(`tel:${customer.phone}`), show: !!customer.phone },
              { icon: MessageCircle, text: 'Text', run: () => Linking.openURL(`sms:${customer.phone}`), show: !!customer.phone },
              {
                icon: Navigation,
                text: 'Directions',
                run: () =>
                  Linking.openURL(
                    `https://maps.apple.com/?daddr=${encodeURIComponent(`${customer.address}, ${customer.postcode}`)}`,
                  ),
                show: !!(customer.address || customer.postcode),
              },
            ]
              .filter((a) => a.show)
              .map(({ icon: Icon, text, run }, i) => (
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
          </View>
        </Group>

        {f.lost ? (
          <Group className="p-4 mb-6">
            <Text className="text-fg text-base font-semibold mb-1">This job didn’t go ahead</Text>
            <Text className="text-secondary text-[15px] mb-2">It’s kept here in case {first} comes back.</Text>
            <Pressable
              onPress={() => (store().setLost(job.id, false), toast('Job reopened'))}
              className="min-h-[44px] justify-center self-start"
              accessibilityRole="button"
            >
              <Text className="text-link text-base font-semibold">Reopen the job</Text>
            </Pressable>
          </Group>
        ) : (
          <>
            {/* The checklist */}
            <SectionHeader title="The job, step by step" />
            <Group>
              {steps.map((s, i) => {
                const isNext = p.next === s.key;
                return (
                  <View key={s.key}>
                    {i > 0 && <View className="h-px bg-divider ml-[50px]" />}
                    <View
                      className="flex-row items-start px-4 py-3 min-h-[60px]"
                      accessible={false}
                      accessibilityLabel={`${s.label}: ${s.note}`}
                    >
                      <View className="pt-0.5">
                        {s.state === 'done' ? (
                          <CircleCheck size={22} color={t.link} strokeWidth={2} />
                        ) : s.state === 'half' ? (
                          <Clock size={22} color={t.link} strokeWidth={2} />
                        ) : (
                          <Circle size={22} color={t.secondary} strokeWidth={2} />
                        )}
                      </View>
                      <View className="flex-1 ml-3 mr-2">
                        <Text className="text-fg text-base font-semibold">{s.label}</Text>
                        <Text className={cn('text-sm', s.noteAlert ? 'text-alert' : 'text-secondary')}>{s.note}</Text>
                        {s.extra}
                      </View>
                      <View className="items-end gap-1">
                        {s.action && (
                          <Pressable
                            onPress={s.action.run}
                            className={cn(
                              'rounded-xl h-9 px-3 items-center justify-center active:opacity-70',
                              isNext ? 'bg-accent' : 'bg-bg',
                            )}
                            accessibilityRole="button"
                            accessibilityLabel={`${s.action.label}: ${s.label}`}
                          >
                            <Text className={cn('text-[15px] font-semibold', isNext ? 'text-on-accent' : 'text-link')}>
                              {s.action.label}
                            </Text>
                          </Pressable>
                        )}
                        {s.undo && (
                          <Pressable
                            onPress={s.undo}
                            hitSlop={8}
                            className="min-h-[32px] justify-center px-1"
                            accessibilityRole="button"
                            accessibilityLabel={`Undo ${s.label}`}
                          >
                            <Text className="text-secondary text-sm">Undo</Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}
              <View className="h-px bg-divider ml-[50px]" />
              <Pressable
                onPress={() => {
                  store().setLost(job.id, true);
                  toast('Moved to “Didn’t go ahead”');
                  goBack();
                }}
                className="flex-row items-center px-4 py-3 min-h-[56px] active:opacity-70"
                accessibilityRole="button"
              >
                <CircleX size={22} color={t.secondary} strokeWidth={2} />
                <View className="flex-1 ml-3">
                  <Text className="text-secondary text-base">Didn’t go ahead</Text>
                  <Text className="text-secondary text-[13px]">Said no, or went elsewhere. Kept, not deleted.</Text>
                </View>
              </Pressable>
            </Group>
            <Text className="text-secondary text-[13px] mx-1 mt-2 mb-8">
              Do any step in any order. Everything saves as you go.
            </Text>
          </>
        )}

        {/* Price */}
        {job.quote && (
          <View className="mb-8">
            <SectionHeader
              title="Price"
              actionLabel={quoteEditable ? 'Edit' : undefined}
              onAction={
                quoteEditable
                  ? () => setEditQuote({ labour: job.quote!.labour, materials: job.quote!.materials, travel: job.quote!.travel })
                  : undefined
              }
            />
            <Group className="px-4 py-3">
              <Line
                label={job.urgency === 'standard' ? 'Labour' : `Labour (${job.urgency} rate)`}
                value={formatAmount(job.quote.labour)}
              />
              {job.quote.materials > 0 && <Line label="Materials" value={formatAmount(job.quote.materials)} />}
              {job.quote.travel > 0 && <Line label="Travel" value={formatAmount(job.quote.travel)} />}
              {job.quote.emergencySurcharge > 0 && (
                <Line label="Emergency call-out" value={formatAmount(job.quote.emergencySurcharge)} />
              )}
              {job.quote.vat > 0 && <Line label="VAT" value={formatAmount(job.quote.vat)} />}
              <View className="h-px bg-divider my-2" />
              <Line label="Total" value={formatAmount(job.quote.total)} strong />
            </Group>
            {quoteEditable && partsTotal > job.quote.materials && (
              <Pressable
                onPress={() => setEditQuote({ labour: job.quote!.labour, materials: partsTotal, travel: job.quote!.travel })}
                className="flex-row items-center mx-1 mt-2 min-h-[44px] active:opacity-70"
                accessibilityRole="button"
              >
                <CircleAlert size={16} color={t.secondary} strokeWidth={2} />
                <Text className="flex-1 text-secondary text-[14px] ml-2">
                  The price doesn’t include {formatAmount(partsTotal)} of parts.{' '}
                  <Text className="text-link font-semibold">Add them</Text>
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Profit, once the work's done */}
        {job.quote && f.done && (partsTotal > 0 || expensesTotal > 0) && (
          <View className="mb-8">
            <SectionHeader title="Profit" />
            <Group className="px-4 py-3">
              {(() => {
                const revenue = job.quote.total - job.quote.vat;
                const profit = revenue - partsTotal - expensesTotal;
                return (
                  <>
                    <Line label="Charged (before VAT)" value={formatAmount(revenue)} />
                    {partsTotal > 0 && <Line label={`Parts (${parts.length})`} value={formatAmount(-partsTotal)} />}
                    {expensesTotal > 0 && (
                      <Line label={`Expenses (${jobExpenses.length})`} value={formatAmount(-expensesTotal)} />
                    )}
                    <View className="h-px bg-divider my-2" />
                    <Line
                      label={revenue > 0 ? `Profit · ${Math.round((profit / revenue) * 100)}%` : 'Profit'}
                      value={formatAmount(profit)}
                      strong
                    />
                  </>
                );
              })()}
            </Group>
          </View>
        )}

        {/* Parts and materials */}
        <View className="mb-8">
          <SectionHeader title="Parts and materials" />
          <Group>
            {parts.map((part, i) => (
              <View key={part.id}>
                {i > 0 && <RowDivider />}
                <View className="flex-row items-center pl-4">
                  <View className="flex-1 py-2.5">
                    <Text className="text-fg text-base">{part.name}</Text>
                    <Text className="text-secondary text-sm">
                      {part.quantity} × {formatAmount(part.unitCost)}
                    </Text>
                  </View>
                  <Text className="text-fg text-base">{formatAmount(part.quantity * part.unitCost)}</Text>
                  <Pressable
                    onPress={() => store().removePart(job.id, part.id)}
                    className="w-11 h-11 items-center justify-center active:opacity-60"
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${part.name}`}
                  >
                    <Trash2 size={16} color={t.secondary} strokeWidth={2} />
                  </Pressable>
                </View>
              </View>
            ))}
            {parts.length > 0 && <RowDivider />}
            {addingPart ? (
              <View className="p-4 gap-3">
                <LabeledField
                  label="What is it?"
                  value={partName}
                  onChangeText={setPartName}
                  placeholder="e.g. 15mm compression valve"
                  autoFocus
                />
                <View className="flex-row gap-3">
                  <LabeledField
                    className="flex-1"
                    label="How many"
                    value={partQty}
                    onChangeText={setPartQty}
                    placeholder="1"
                    keyboardType="number-pad"
                  />
                  <LabeledField
                    className="flex-1"
                    label="Price each"
                    value={partCost}
                    onChangeText={setPartCost}
                    placeholder={currencySymbol()}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View className="flex-row items-center justify-end gap-5 mt-1">
                  <Pressable onPress={cancelPart} hitSlop={8} accessibilityRole="button">
                    <Text className="text-secondary text-[15px] font-semibold">Cancel</Text>
                  </Pressable>
                  <PrimaryButton compact label="Add to the job" onPress={savePart} />
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setAddingPart(true)}
                className="flex-row items-center px-4 min-h-[52px] active:opacity-70"
                accessibilityRole="button"
              >
                <Plus size={20} color={t.link} strokeWidth={2} />
                <Text className="text-link text-base font-semibold ml-2">Add part</Text>
                {partsTotal > 0 && <Text className="ml-auto text-secondary text-[15px]">Total {formatAmount(partsTotal)}</Text>}
              </Pressable>
            )}
          </Group>
        </View>

        {/* Notes: saved as you type */}
        <View className="mb-8">
          <SectionHeader title="Notes" />
          <Group className="px-4 py-3">
            <TextInput
              value={job.notes}
              onChangeText={(notes) => updateJob(job.id, { notes })}
              multiline
              placeholder="Access, parking, what you found, what to bring"
              placeholderTextColor={t.secondary}
              className="text-fg text-base min-h-[88px]"
              style={{ textAlignVertical: 'top' }}
              accessibilityLabel="Notes"
            />
          </Group>
          <Text className="text-secondary text-[13px] mx-1 mt-2">
            Only you see notes. Tip: tap the microphone key on the keyboard to speak them.
          </Text>
        </View>

        {/* Photos: one list, as many as you like */}
        <View className="mb-8">
          <SectionHeader title="Photos" />
          <View className="flex-row flex-wrap gap-2">
            {photos.map((photo) => (
              <Pressable
                key={photo.id}
                onLongPress={() => handleDeletePhoto(photo.id, photo.uri)}
                className="rounded-xl overflow-hidden"
                style={{ width: '31.5%', aspectRatio: 1 }}
                accessibilityLabel="Photo. Hold to delete."
              >
                <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </Pressable>
            ))}
            <Pressable
              onPress={handleAddPhoto}
              className="rounded-xl border border-dashed border-divider items-center justify-center active:opacity-70"
              style={{ width: '31.5%', aspectRatio: 1 }}
              accessibilityRole="button"
              accessibilityLabel="Add photo"
            >
              <Plus size={22} color={t.link} strokeWidth={2} />
              <Text className="text-link text-[13px] font-semibold mt-1">Add</Text>
            </Pressable>
          </View>
          <Text className="text-secondary text-[13px] mx-1 mt-2">
            {photos.length
              ? `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} · hold one to delete it`
              : 'Add as many as you like.'}
          </Text>
        </View>

        {/* Expenses (Pro): no upsell on the job itself */}
        {isPro && (
          <View className="mb-8">
            <SectionHeader title="Expenses" />
            <Group>
              {jobExpenses.map((expense, i) => (
                <View key={expense.id}>
                  {i > 0 && <RowDivider />}
                  <View className="flex-row items-center px-4 py-2.5">
                    <View className="flex-1">
                      <Text className="text-fg text-base">{expense.description}</Text>
                      <Text className="text-secondary text-sm">{EXPENSE_CATEGORY_LABELS[expense.category]}</Text>
                    </View>
                    <Text className="text-fg text-base">{formatAmount(expense.amount)}</Text>
                  </View>
                </View>
              ))}
              {jobExpenses.length > 0 && <RowDivider />}
              <Pressable
                onPress={() => router.push(`/add-expense?jobId=${job.id}`)}
                className="flex-row items-center px-4 min-h-[52px] active:opacity-70"
                accessibilityRole="button"
              >
                <Plus size={20} color={t.link} strokeWidth={2} />
                <Text className="text-link text-base font-semibold ml-2">Add expense</Text>
                {expensesTotal > 0 && (
                  <Text className="ml-auto text-secondary text-[15px]">Total {formatAmount(expensesTotal)}</Text>
                )}
              </Pressable>
            </Group>
          </View>
        )}

        {/* A job made by mistake can be deleted; one that went nowhere is better as "Didn't go ahead" */}
        {!invoice && (
          <Group>
            <LinkRow icon={Trash2} label="Delete job" destructive onPress={() => setConfirmDelete(true)} />
          </Group>
        )}
      </ScrollView>

      {/* Book, or change the booking */}
      <Sheet visible={showBook} onClose={() => setShowBook(false)}>
        <Text className="text-fg text-[20px] font-semibold mb-1" accessibilityRole="header">
          {f.booked || offers.length ? 'Change the booking' : `Book ${first} in`}
        </Text>
        <Text className="text-secondary text-[15px] mb-4">Booking counts as {first} saying yes to the quote.</Text>
        <Group className="bg-bg">
          <LinkRow
            icon={CalendarClock}
            label={offers.length || expired ? 'Suggest different times' : 'Suggest 3 times'}
            onPress={openSuggest}
          />
          <RowDivider />
          <LinkRow icon={Calendar} label={f.booked ? 'Change the time' : 'Pick a time myself'} onPress={openPicker} />
          {f.booked && (
            <>
              <RowDivider />
              <LinkRow icon={Bell} label={`Remind ${first} about the visit`} onPress={handleRemindVisit} />
              <RowDivider />
              <LinkRow icon={CalendarPlus} label="Add to my calendar" onPress={handleAddToCalendar} />
            </>
          )}
          {(f.booked || offers.length > 0) && (
            <>
              <RowDivider />
              <LinkRow
                icon={CalendarX}
                label={f.booked ? 'Remove the booking' : 'Cancel the times I offered'}
                destructive
                onPress={() => {
                  setShowBook(false);
                  if (f.booked) setConfirmUnbook(true);
                  else unbook();
                }}
              />
            </>
          )}
        </Group>
      </Sheet>

      {/* Pick a time */}
      <Sheet visible={showSchedule} onClose={() => setShowSchedule(false)}>
        <Text className="text-fg text-[17px] font-semibold text-center mb-4">{f.booked ? 'Change the time' : 'Pick a time'}</Text>
        <Segmented
          className="mb-3 bg-bg"
          options={[
            {
              key: 'date',
              label: scheduleDate.toLocaleDateString(getRegion().locale, { weekday: 'short', day: 'numeric', month: 'short' }),
            },
            { key: 'time', label: formatTime(hhmm(scheduleDate)) },
          ]}
          value={pickerMode}
          onChange={setPickerMode}
        />
        <View className="bg-bg rounded-2xl mb-4 overflow-hidden items-center">
          <DateTimePicker
            value={scheduleDate}
            mode={pickerMode}
            display="spinner"
            minimumDate={new Date()}
            onChange={(_, d) => d && setScheduleDate(d)}
            themeVariant={t.mode}
            accentColor={t.link}
            textColor={t.fg}
            minuteInterval={15}
          />
        </View>
        <PrimaryButton label="Book it" onPress={confirmSchedule} />
      </Sheet>

      {/* Edit price */}
      {editQuote && job.quote && (
        <Sheet visible onClose={() => setEditQuote(null)}>
          <Text className="text-fg text-[20px] font-semibold mb-4">Edit price</Text>
          <Group className="bg-bg mb-3">
            <NumberFieldRow
              label="Labour"
              prefix={currencySymbol()}
              value={editQuote.labour}
              onChangeNumber={(n) => setEditQuote({ ...editQuote, labour: n })}
              width="w-24"
            />
            <RowDivider />
            <NumberFieldRow
              label="Materials"
              prefix={currencySymbol()}
              value={editQuote.materials}
              onChangeNumber={(n) => setEditQuote({ ...editQuote, materials: n })}
              width="w-24"
            />
            <RowDivider />
            <NumberFieldRow
              label="Travel"
              prefix={currencySymbol()}
              value={editQuote.travel}
              onChangeNumber={(n) => setEditQuote({ ...editQuote, travel: n })}
              width="w-24"
            />
          </Group>
          {partsTotal > 0 && editQuote.materials !== partsTotal && (
            <Pressable
              onPress={() => setEditQuote({ ...editQuote, materials: partsTotal })}
              className="min-h-[44px] justify-center mb-1"
              accessibilityRole="button"
            >
              <Text className="text-link text-[15px] font-semibold">
                Use parts total for materials ({formatAmount(partsTotal)})
              </Text>
            </Pressable>
          )}
          {(() => {
            const priced = priceQuote(settings, editQuote, job.quote.emergencySurcharge);
            return (
              <View className="px-1 mb-5">
                {priced.emergencySurcharge > 0 && (
                  <Line label="Emergency call-out" value={formatAmount(priced.emergencySurcharge)} />
                )}
                {priced.vat > 0 && <Line label={`VAT (${settings.vatRate}%)`} value={formatAmount(priced.vat)} />}
                <Line label="Total" value={formatAmount(priced.total)} strong />
              </View>
            );
          })()}
          <PrimaryButton
            label="Save price"
            onPress={async () => {
              updateQuote(job.id, editQuote);
              toast('Price updated');
              setEditQuote(null);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          />
        </Sheet>
      )}

      {/* Edit job: type, name, description, urgency */}
      {editJob && (
        <Sheet visible onClose={() => setEditJob(null)}>
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ maxHeight: 640 }}>
            <Text className="text-fg text-[20px] font-semibold mb-4">Edit job</Text>
            <Text className="text-secondary text-[13px] mx-1 mb-1.5">Job type</Text>
            <Group className="bg-bg mb-4">
              {pricingPresets
                .filter((x) => x.type !== 'emergency' || job.type === 'emergency')
                .map((x, i) => (
                  <View key={x.type}>
                    {i > 0 && <RowDivider />}
                    <ChoiceRow
                      label={x.label}
                      selected={editJob.type === x.type}
                      onPress={() => setEditJob({ ...editJob, type: x.type })}
                    />
                  </View>
                ))}
              <RowDivider />
              <ChoiceRow
                label="Something else"
                selected={editJob.type === 'custom'}
                onPress={() => setEditJob({ ...editJob, type: 'custom' })}
              />
            </Group>
            {editJob.type === 'custom' && (
              <LabeledField
                className="mb-4"
                label="What’s the job?"
                value={editJob.customName}
                onChangeText={(v) => setEditJob({ ...editJob, customName: v })}
                placeholder="e.g. Fit an outside tap"
              />
            )}
            <Text className="text-secondary text-[13px] mx-1 mb-1.5">What needs doing</Text>
            <Group className="bg-bg mb-4">
              <TextInput
                className="text-fg text-base px-4 py-3 min-h-[72px]"
                style={{ textAlignVertical: 'top' }}
                value={editJob.description}
                onChangeText={(v) => setEditJob({ ...editJob, description: v })}
                placeholder="Optional"
                placeholderTextColor={t.secondary}
                multiline
                accessibilityLabel="What needs doing"
              />
            </Group>
            <Segmented
              className="mb-2"
              options={[
                { key: 'standard', label: 'Standard' },
                { key: 'urgent', label: 'Urgent' },
                { key: 'emergency', label: 'Emergency' },
              ]}
              value={editJob.urgency}
              onChange={(u) => setEditJob({ ...editJob, urgency: u })}
            />
            {job.quote &&
              !invoice &&
              editJob.type !== 'custom' &&
              (editJob.type !== job.type || editJob.urgency !== job.urgency) && (
                <Text className="text-secondary text-[13px] mx-1 mb-2">
                  Labour changes to {formatAmount(calculateQuote(editJob.type, editJob.urgency).labour)}. Materials and travel
                  stay as they are.
                </Text>
              )}
            <PrimaryButton
              label="Save"
              className="mt-3"
              disabled={editJob.type === 'custom' && !editJob.customName.trim()}
              onPress={async () => {
                const priceChanged = editJob.type !== 'custom' && (editJob.type !== job.type || editJob.urgency !== job.urgency);
                updateJob(job.id, {
                  type: editJob.type,
                  customName: editJob.type === 'custom' ? editJob.customName.trim() : undefined,
                  description: editJob.description.trim(),
                  urgency: editJob.urgency,
                });
                // A different job type or urgency means a different price, until it's on an invoice.
                if (priceChanged && job.quote && !invoice) {
                  updateQuote(job.id, {
                    labour: calculateQuote(editJob.type, editJob.urgency).labour,
                    materials: job.quote.materials,
                    travel: job.quote.travel,
                  });
                }
                setEditJob(null);
                toast('Job updated');
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
            />
          </ScrollView>
        </Sheet>
      )}

      {/* Edit customer */}
      {editCustomer && (
        <Sheet visible onClose={() => setEditCustomer(null)}>
          <Text className="text-fg text-[20px] font-semibold mb-4">Customer details</Text>
          <Group className="bg-bg mb-5">
            <FieldRow
              label="Name"
              value={editCustomer.name}
              onChangeText={(v) => setEditCustomer({ ...editCustomer, name: v })}
              placeholder="Name"
              autoCapitalize="words"
              width="w-48"
            />
            <RowDivider />
            <FieldRow
              label="Mobile"
              value={editCustomer.phone}
              onChangeText={(v) => setEditCustomer({ ...editCustomer, phone: v })}
              placeholder="Mobile"
              keyboardType="phone-pad"
              width="w-48"
            />
            <RowDivider />
            <FieldRow
              label="Email"
              value={editCustomer.email}
              onChangeText={(v) => setEditCustomer({ ...editCustomer, email: v })}
              placeholder="Optional"
              keyboardType="email-address"
              autoCapitalize="none"
              width="w-48"
            />
            <RowDivider />
            <FieldRow
              label="Address"
              value={editCustomer.address}
              onChangeText={(v) => setEditCustomer({ ...editCustomer, address: v })}
              placeholder="Optional"
              width="w-48"
            />
            <RowDivider />
            <FieldRow
              label={getRegion().country === 'US' ? 'ZIP code' : 'Postcode'}
              value={editCustomer.postcode}
              onChangeText={(v) => setEditCustomer({ ...editCustomer, postcode: v.toUpperCase() })}
              autoCapitalize="characters"
              width="w-28"
            />
          </Group>
          <PrimaryButton
            label="Save"
            disabled={!editCustomer.name.trim()}
            onPress={() => {
              store().updateCustomer(customer.id, {
                name: editCustomer.name.trim(),
                phone: editCustomer.phone.trim(),
                email: editCustomer.email.trim(),
                address: editCustomer.address.trim(),
                postcode: editCustomer.postcode.trim(),
              });
              toast('Customer updated');
              setEditCustomer(null);
            }}
          />
        </Sheet>
      )}

      <ConfirmModal
        visible={confirmUnbook}
        title="Remove this booking?"
        message="The job stays, without a time, so you can book it again. Its reminder and calendar event are removed. Let the customer know yourself."
        confirmText="Remove booking"
        cancelText="Keep it"
        variant="warning"
        onConfirm={unbook}
        onCancel={() => {}}
        onDismiss={() => setConfirmUnbook(false)}
      />

      <ConfirmModal
        visible={confirmDelete}
        title="Delete this job?"
        message={`The job for ${customer.name} and its quote, parts, notes and photos will be deleted. This can’t be undone. If it just didn’t go ahead, use “Didn’t go ahead” instead.`}
        confirmText="Delete job"
        cancelText="Cancel"
        variant="error"
        onConfirm={async () => {
          await cancelJobReminder(job.id);
          await removeJobFromCalendar(job.id);
          store().deleteJob(job.id);
          toast('Job deleted');
          goBack();
        }}
        onCancel={() => {}}
        onDismiss={() => setConfirmDelete(false)}
      />

      <UpgradePrompt visible={limitPrompt} onClose={() => setLimitPrompt(false)} feature="invoices" />

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
