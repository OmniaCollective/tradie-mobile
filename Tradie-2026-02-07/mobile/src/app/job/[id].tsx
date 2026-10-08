import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Linking, Image, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Phone,
  MessageCircle,
  Navigation,
  Calendar,
  CalendarPlus,
  CalendarClock,
  Bell,
  Share2,
  Plus,
  Trash2,
  CircleAlert,
  Lock,
  Pencil,
  CalendarX,
  FileText,
  Eye,
  type LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as SMS from 'expo-sms';
import {
  useTradeStore,
  useJobExpenses,
  EXPENSE_CATEGORY_LABELS,
  getRegion,
  getJobTypeLabel,
  businessDisplayName,
  priceQuote,
  usePricingPresets,
  daysOverdue,
  type JobType,
  type Urgency,
  type OfferedSlot,
  type BusinessSettings,
} from '@/lib/store';
import { syncJobToCalendar, requestCalendarPermissions, hasCalendarPermissions, removeJobFromCalendar } from '@/lib/calendarSync';
import { cancelJobReminder } from '@/lib/notifications';
import { activeOffer, offerExpired, formatSlot, slotDate, scheduleJob, confirmationMessage } from '@/lib/booking';
import { useBusinessDetailsPrompt } from '@/components/BusinessDetailsPrompt';
import { sendCustomerReminder, sendQuoteFollowup, isQuoteExpiringSoon } from '@/lib/customerReminders';
import { ConfirmModal } from '@/components/ConfirmModal';
import { UpgradePrompt } from '@/components/UpgradePrompt';
import { JobStatus, nextStep as nextStepText } from '@/components/JobStatus';
import { formatDateFull, formatTime, toDateKey } from '@/lib/dates';
import { formatAmount, currencySymbol } from '@/lib/money';
import { exportQuotePdf } from '@/lib/invoiceExport';
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
} from '@/components/ui';
import { toast } from '@/components/Toast';

type PhotoTab = 'before' | 'during' | 'after';

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

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  // Opened from a link or notification there may be nothing to go back to; then go Home.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const job = useTradeStore((s) => s.jobs.find((j) => j.id === id));
  const customer = useTradeStore((s) => (job ? s.customers.find((c) => c.id === job.customerId) : undefined));
  const settings = useTradeStore((s) => s.settings);
  const { requireDetails, prompt: detailsPrompt } = useBusinessDetailsPrompt();
  const updateJob = useTradeStore((s) => s.updateJob);
  const createInvoice = useTradeStore((s) => s.createInvoice);
  const addPart = useTradeStore((s) => s.addPart);
  const updateQuote = useTradeStore((s) => s.updateQuote);
  const deleteJob = useTradeStore((s) => s.deleteJob);
  const invoiceId = useTradeStore((s) => s.invoices.find((inv) => inv.jobId === id)?.id);
  const hasInvoice = !!invoiceId;
  const invoiceOverdueDays = useTradeStore((st) => {
    const inv = st.invoices.find((i) => i.jobId === id);
    return inv ? daysOverdue(inv, st.settings) : 0;
  });
  const updateCustomer = useTradeStore((s) => s.updateCustomer);
  const removePart = useTradeStore((s) => s.removePart);
  const addPhoto = useTradeStore((s) => s.addPhoto);
  const removePhoto = useTradeStore((s) => s.removePhoto);
  const jobExpenses = useJobExpenses(id);
  const { isPro, canCreateInvoice, invoicesLeft } = useProAccess();

  const [busy, setBusy] = useState<'calendar' | 'reminder' | null>(null);
  const [modal, setModal] = useState<{
    title: string;
    message: string;
    variant?: 'default' | 'success' | 'error' | 'warning';
  } | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [addingPart, setAddingPart] = useState(false);
  const [partName, setPartName] = useState('');
  const [partQty, setPartQty] = useState('');
  const [partCost, setPartCost] = useState('');
  const [photoTab, setPhotoTab] = useState<PhotoTab>('before');
  const [showSchedule, setShowSchedule] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showComplete, setShowComplete] = useState(false);
  const [editQuote, setEditQuote] = useState<{ labour: number; materials: number; travel: number } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCancelBooking, setConfirmCancelBooking] = useState(false);
  const [confirmQuoteSent, setConfirmQuoteSent] = useState(false);
  const [editJob, setEditJob] = useState<{ type: JobType; description: string; urgency: Urgency } | null>(null);
  const pricingPresets = usePricingPresets();
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

  const label = getJobTypeLabel(settings.trade, job.type);
  const parts = job.parts ?? [];
  const partsTotal = parts.reduce((s, p) => s + p.quantity * p.unitCost, 0);
  const expensesTotal = jobExpenses.reduce((s, e) => s + e.amount, 0);
  const photos = (job.photos ?? []).filter((p) => p.type === photoTab);
  const isDone = job.status === 'COMPLETED' || job.status === 'INVOICED' || job.status === 'PAID';
  // The price can change until it's on an invoice.
  const quoteEditable = !hasInvoice;

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    const destDir = `${FileSystem.documentDirectory}job-photos/`;
    await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
    const destUri = `${destDir}${makePhotoFileName()}`;
    await FileSystem.copyAsync({ from: result.assets[0].uri, to: destUri });
    addPhoto(job.id, {
      uri: destUri,
      type: photoTab,
      createdAt: new Date().toISOString(),
    });
  };

  const handleDeletePhoto = async (photoId: string, uri: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    removePhoto(job.id, photoId);
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {}
  };

  const confirmSchedule = async () => {
    setShowSchedule(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await scheduleJob(job, customer, scheduleDate);
    toast('Job booked');
  };

  /** Customer replied with one of the offered times: book it and send a confirmation. */
  const bookOffered = async (slot: OfferedSlot) => {
    const when = slotDate(slot);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await scheduleJob(job, customer, when);
    toast('Job booked');
    // The job is booked either way; the confirmation text is signed, so it waits for a name.
    if (customer.phone && Platform.OS !== 'web' && (await SMS.isAvailableAsync())) {
      requireDetails('message', async () => {
        await SMS.sendSMSAsync([customer.phone], confirmationMessage(customer, when));
      });
    }
  };

  const offers = activeOffer(job);
  const expired = offerExpired(job);
  const unscheduled = !job.scheduledDate && (job.status === 'REQUESTED' || job.status === 'QUOTED' || job.status === 'APPROVED');
  const openSuggest = () => router.push(`/suggest-times?jobId=${job.id}`);
  const openPicker = () => {
    // Changing a booked time starts from the current one.
    if (job.scheduledDate) setScheduleDate(slotDate({ date: job.scheduledDate, time: job.scheduledTime || '09:00' }));
    setPickerMode('date');
    setShowSchedule(true);
  };

  const handleAddToCalendar = async () => {
    setBusy('calendar');
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
        setModal({
          title: 'Added to your calendar',
          message: 'With a reminder before the job.',
          variant: 'success',
        });
      } else {
        setModal({
          title: 'Couldn’t add it',
          message: 'Please try again.',
          variant: 'error',
        });
      }
    } catch (error) {
      if (__DEV__) console.error('Calendar sync error:', error);
      setModal({
        title: 'Couldn’t add it',
        message: 'Please try again.',
        variant: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  // Each of these asks for any missing business details first, then sends.
  const handleRemindCustomer = () =>
    requireDetails('message', async (current) => {
      setBusy('reminder');
      const type = job.scheduledDate === toDateKey() ? 'morning_of' : 'day_before';
      if (await sendCustomerReminder(customer, job, label, businessDisplayName(current), type)) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setBusy(null);
    });

  const handleQuoteFollowup = () =>
    requireDetails('message', async (current) => {
      setBusy('reminder');
      if (await sendQuoteFollowup(customer, job, label, businessDisplayName(current))) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      setBusy(null);
    });

  const handleShareQuote = () => requireDetails('quote', (current) => shareQuote(current));

  const shareQuote = async (current: BusinessSettings) => {
    try {
      await exportQuotePdf({ job, customer, settings: current });
      // iOS doesn't say whether it was actually sent, so ask before marking it Quoted.
      setConfirmQuoteSent(true);
    } catch (error) {
      if (__DEV__) console.error('Quote PDF error:', error);
      setModal({
        title: 'Couldn’t create the PDF',
        message: 'Please try again.',
        variant: 'error',
      });
    }
  };

  const handleCreateInvoice = async () => {
    if (!canCreateInvoice) {
      setLimitPrompt(true);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (createInvoice(job.id)) {
      toast('Invoice created');
      router.push('/(tabs)/finances');
    }
  };

  const savePart = () => {
    const qty = parseInt(partQty, 10);
    const cost = parseFloat(partCost.replace(',', '.'));
    if (!partName.trim() || !(qty > 0) || !(cost > 0)) return;
    addPart(job.id, { name: partName.trim(), quantity: qty, unitCost: cost });
    toast('Part added');
    cancelPart();
  };
  const cancelPart = () => {
    setPartName('');
    setPartQty('');
    setPartCost('');
    setAddingPart(false);
  };

  // The one next step for this stage of the job.
  const nextStep: { label: string; run: () => void } | null = (() => {
    switch (job.status) {
      case 'REQUESTED':
      case 'QUOTED':
        return {
          label: 'Customer approved the quote',
          run: () => updateJob(job.id, { status: 'APPROVED', acceptedAt: job.acceptedAt ?? new Date().toISOString() }),
        };
      case 'APPROVED':
        // Once times are offered, booking happens from the offered times.
        return offers.length ? null : { label: expired ? 'Offer new times' : 'Suggest times', run: openSuggest };
      case 'SCHEDULED':
        return {
          label: 'Start job',
          run: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            updateJob(job.id, { status: 'IN_PROGRESS' });
            toast('Job started');
          },
        };
      case 'IN_PROGRESS':
        return { label: 'Mark job done', run: () => setShowComplete(true) };
      case 'COMPLETED':
        return {
          label: isPro || !Number.isFinite(invoicesLeft) ? 'Create invoice' : `Create invoice (${invoicesLeft} free left)`,
          run: handleCreateInvoice,
        };
      default:
        return null;
    }
  })();

  const contactActions: {
    icon: LucideIcon;
    label: string;
    run: () => void;
    show: boolean;
  }[] = [
    {
      icon: Phone,
      label: 'Call',
      run: () => Linking.openURL(`tel:${customer.phone}`),
      show: !!customer.phone,
    },
    {
      icon: MessageCircle,
      label: 'Text',
      run: () => Linking.openURL(`sms:${customer.phone}`),
      show: !!customer.phone,
    },
    {
      icon: Navigation,
      label: 'Directions',
      run: () =>
        Linking.openURL(`https://maps.apple.com/?daddr=${encodeURIComponent(`${customer.address}, ${customer.postcode}`)}`),
      show: !!customer.address,
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
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: nextStep ? 120 : 40,
        }}
      >
        {/* Title */}
        <View className="mb-6">
          <View className="flex-row items-center mb-2">
            <JobStatus job={job} size="md" />
            {job.urgency === 'urgent' && !isDone && <Text className="text-secondary text-sm font-semibold ml-2">· Urgent</Text>}
            <Text className="text-secondary text-sm ml-2" numberOfLines={1}>
              · {nextStepText(job, customer.name, { overdueDays: invoiceOverdueDays })}
            </Text>
          </View>
          <View className="flex-row items-start justify-between">
            <Text className="flex-1 text-fg text-[28px] font-bold tracking-tight mr-3">{label}</Text>
            <Pressable
              onPress={() => setEditJob({ type: job.type, description: job.description ?? '', urgency: job.urgency })}
              hitSlop={10}
              className="min-h-[44px] justify-center"
              accessibilityRole="button"
              accessibilityLabel="Edit job"
            >
              <Text className="text-link text-[15px] font-semibold">Edit</Text>
            </Pressable>
          </View>
          {job.description ? <Text className="text-secondary text-base leading-6 mt-1">{job.description}</Text> : null}
        </View>

        {/* Customer */}
        <Group className="mb-8">
          <View className="px-4 pt-4 pb-3">
            <View className="flex-row items-center justify-between">
              <Text className="flex-1 text-fg text-[17px] font-semibold mr-3">{customer.name}</Text>
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
            {!!(customer.address || customer.postcode) && (
              <Text className="text-secondary text-[15px] mt-0.5">
                {[customer.address, customer.postcode].filter(Boolean).join(', ')}
              </Text>
            )}
          </View>
          <View className="flex-row border-t border-divider">
            {contactActions
              .filter((a) => a.show)
              .map(({ icon: Icon, label: text, run }, i) => (
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

        {/* Scheduling an unbooked job */}
        {unscheduled && (
          <View className="mb-8">
            <SectionHeader title={offers.length ? 'Times offered' : 'When'} />
            <Group>
              {offers.length > 0 && (
                <>
                  {offers.map((slot, i) => (
                    <View key={`${slot.date}T${slot.time}`}>
                      {i > 0 && <RowDivider />}
                      <View className="flex-row items-center px-4 min-h-[52px]">
                        <Text className="text-secondary text-base w-7">{i + 1})</Text>
                        <Text className="flex-1 text-fg text-base">{formatSlot(slotDate(slot))}</Text>
                        <Pressable
                          onPress={() => bookOffered(slot)}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Book ${formatSlot(slotDate(slot))}`}
                        >
                          <Text className="text-link text-[15px] font-semibold">Book</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  <RowDivider />
                </>
              )}
              {expired && (
                <>
                  <View className="px-4 py-3">
                    <Text className="text-secondary text-[15px]">The times you offered have expired and are free again.</Text>
                  </View>
                  <RowDivider />
                </>
              )}
              <LinkRow
                icon={CalendarClock}
                label={offers.length || expired ? 'Offer new times' : 'Suggest times'}
                onPress={openSuggest}
              />
              <RowDivider />
              <LinkRow icon={Calendar} label="Pick a time myself" onPress={openPicker} />
            </Group>
            {offers.length > 0 && (
              <Text className="text-secondary text-[13px] mx-1 mt-2">
                Pencilled in until the customer replies. Tap Book on the one they choose.
              </Text>
            )}
          </View>
        )}

        {/* When */}
        {!!job.scheduledDate && (
          <View className="mb-8">
            <SectionHeader title="When" />
            <Group>
              <View className="flex-row items-center px-4 min-h-[52px]">
                <Calendar size={20} color={t.secondary} strokeWidth={2} />
                <Text className="text-fg text-base ml-3">
                  {formatDateFull(job.scheduledDate)} · {formatTime(job.scheduledTime)}
                </Text>
              </View>
              {job.status === 'SCHEDULED' && (
                <>
                  <RowDivider />
                  <LinkRow
                    icon={CalendarPlus}
                    label={busy === 'calendar' ? 'Adding…' : 'Add to my calendar'}
                    onPress={handleAddToCalendar}
                  />
                  <RowDivider />
                  <LinkRow
                    icon={Bell}
                    label={busy === 'reminder' ? 'Opening…' : 'Remind the customer'}
                    onPress={handleRemindCustomer}
                  />
                  <RowDivider />
                  <LinkRow icon={CalendarClock} label="Change time" onPress={openPicker} />
                  <RowDivider />
                  <LinkRow icon={CalendarX} label="Cancel booking" onPress={() => setConfirmCancelBooking(true)} />
                </>
              )}
            </Group>
          </View>
        )}

        {/* Invoice */}
        {invoiceId && (
          <Group className="mb-8">
            <LinkRow
              icon={FileText}
              label={job.status === 'PAID' ? 'Invoice · paid' : 'See invoice'}
              onPress={() => router.push(`/(tabs)/finances?invoice=${invoiceId}`)}
            />
          </Group>
        )}

        {/* Quote */}
        {job.quote && (
          <View className="mb-8">
            <SectionHeader title="Quote" />
            <Group>
              {job.status === 'QUOTED' && isQuoteExpiringSoon(job) && (
                <>
                  <View className="flex-row items-center px-4 min-h-[52px]">
                    <CircleAlert size={20} color={t.alert} strokeWidth={2} />
                    <Text className="flex-1 text-alert text-[15px] ml-3">Quote expires soon</Text>
                    <Pressable
                      onPress={handleQuoteFollowup}
                      disabled={busy === 'reminder'}
                      hitSlop={8}
                      accessibilityRole="button"
                    >
                      <Text className="text-link text-[15px] font-semibold">Follow up</Text>
                    </Pressable>
                  </View>
                  <RowDivider />
                </>
              )}
              <View className="px-4 py-3">
                <Line label="Labour" value={formatAmount(job.quote.labour)} />
                {job.quote.materials > 0 && <Line label="Materials" value={formatAmount(job.quote.materials)} />}
                {job.quote.travel > 0 && <Line label="Travel" value={formatAmount(job.quote.travel)} />}
                {job.quote.emergencySurcharge > 0 && (
                  <Line label="Emergency call-out" value={formatAmount(job.quote.emergencySurcharge)} />
                )}
                {job.quote.vat > 0 && <Line label="VAT" value={formatAmount(job.quote.vat)} />}
                <View className="h-px bg-divider my-2" />
                <Line label="Total" value={formatAmount(job.quote.total)} strong />
              </View>
              {quoteEditable && (
                <>
                  <RowDivider />
                  <LinkRow
                    icon={Pencil}
                    label="Edit quote"
                    onPress={() =>
                      setEditQuote({ labour: job.quote!.labour, materials: job.quote!.materials, travel: job.quote!.travel })
                    }
                  />
                </>
              )}
              <RowDivider />
              <LinkRow icon={Eye} label="Preview quote" onPress={() => router.push(`/preview?kind=quote&id=${job.id}`)} />
              <RowDivider />
              <LinkRow
                icon={Share2}
                label={job.quoteSentAt ? 'Share quote again' : 'Send quote as PDF'}
                onPress={handleShareQuote}
              />
            </Group>
          </View>
        )}

        {/* Profit */}
        {job.quote && isDone && (
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
                    {expensesTotal > 0 && <Line label={`Expenses (${jobExpenses.length})`} value={formatAmount(-expensesTotal)} />}
                    <View className="h-px bg-divider my-2" />
                    <Line
                      label={revenue > 0 ? `Profit · ${Math.round((profit / revenue) * 100)}%` : 'Profit'}
                      value={formatAmount(profit)}
                      strong
                    />
                    {partsTotal === 0 && expensesTotal === 0 && (
                      <Text className="text-secondary text-[13px] mt-1">Add parts or expenses to see your real margin.</Text>
                    )}
                  </>
                );
              })()}
            </Group>
          </View>
        )}

        {/* Parts */}
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
                    onPress={() => removePart(job.id, part.id)}
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
              <View className="p-4 gap-2">
                <TextInput
                  value={partName}
                  onChangeText={setPartName}
                  placeholder="Part name"
                  placeholderTextColor={t.secondary}
                  className="bg-bg text-fg text-base rounded-xl px-3 h-11"
                  autoFocus
                  accessibilityLabel="Part name"
                />
                <View className="flex-row gap-2">
                  <TextInput
                    value={partQty}
                    onChangeText={setPartQty}
                    placeholder="Qty"
                    placeholderTextColor={t.secondary}
                    keyboardType="number-pad"
                    className="flex-1 bg-bg text-fg text-base rounded-xl px-3 h-11"
                    accessibilityLabel="Quantity"
                  />
                  <TextInput
                    value={partCost}
                    onChangeText={setPartCost}
                    placeholder={`${currencySymbol()} each`}
                    placeholderTextColor={t.secondary}
                    keyboardType="decimal-pad"
                    className="flex-1 bg-bg text-fg text-base rounded-xl px-3 h-11"
                    accessibilityLabel="Cost each"
                  />
                </View>
                <View className="flex-row items-center justify-end gap-5 mt-1">
                  <Pressable onPress={cancelPart} hitSlop={8} accessibilityRole="button">
                    <Text className="text-secondary text-[15px] font-semibold">Cancel</Text>
                  </Pressable>
                  <PrimaryButton compact label="Add part" onPress={savePart} />
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

        {/* Notes */}
        <View className="mb-8">
          <SectionHeader title="Notes" />
          <Group className="p-4">
            {editingNotes ? (
              <>
                <TextInput
                  value={notesText}
                  onChangeText={setNotesText}
                  multiline
                  placeholder="Access codes, materials, what the customer said…"
                  placeholderTextColor={t.secondary}
                  className="text-fg text-base min-h-[88px]"
                  style={{ textAlignVertical: 'top' }}
                  autoFocus
                  accessibilityLabel="Notes"
                />
                <View className="flex-row items-center justify-end gap-5 mt-2">
                  {/* Dictation is built into the iPhone keyboard; this just points to it */}
                  <Text className="flex-1 text-secondary text-[13px]">
                    Tip: tap the microphone key on the keyboard to speak it.
                  </Text>
                  <Pressable onPress={() => setEditingNotes(false)} hitSlop={8} accessibilityRole="button">
                    <Text className="text-secondary text-[15px] font-semibold">Cancel</Text>
                  </Pressable>
                  <PrimaryButton
                    compact
                    label="Save"
                    onPress={() => {
                      updateJob(job.id, { notes: notesText.trim() });
                      setEditingNotes(false);
                    }}
                  />
                </View>
              </>
            ) : (
              <Pressable
                onPress={() => {
                  setNotesText(job.notes || '');
                  setEditingNotes(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={job.notes ? 'Edit notes' : 'Add notes'}
              >
                <Text className={cn('text-base leading-6', job.notes ? 'text-fg' : 'text-secondary')}>
                  {job.notes || 'Tap to add notes'}
                </Text>
              </Pressable>
            )}
          </Group>
        </View>

        {/* Photos */}
        <View className="mb-8">
          <SectionHeader title="Photos" />
          <Segmented
            className="mb-3"
            options={[
              { key: 'before', label: 'Before' },
              { key: 'during', label: 'During' },
              { key: 'after', label: 'After' },
            ]}
            value={photoTab}
            onChange={setPhotoTab}
          />
          {photos.length > 0 && (
            <View className="flex-row flex-wrap justify-between mb-3">
              {photos.map((photo) => (
                <Pressable
                  key={photo.id}
                  onLongPress={() => handleDeletePhoto(photo.id, photo.uri)}
                  className="rounded-2xl overflow-hidden mb-2"
                  style={{ width: '49%', aspectRatio: 1 }}
                  accessibilityLabel={`${photoTab} photo. Hold to delete.`}
                >
                  <Image source={{ uri: photo.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          )}
          <Group>
            <Pressable
              onPress={handleAddPhoto}
              className="flex-row items-center px-4 min-h-[52px] active:opacity-70"
              accessibilityRole="button"
            >
              <Plus size={20} color={t.link} strokeWidth={2} />
              <Text className="text-link text-base font-semibold ml-2">Add {photoTab} photo</Text>
            </Pressable>
          </Group>
          {photos.length > 0 && <Text className="text-secondary text-[13px] mx-1 mt-2">Hold a photo to delete it.</Text>}
        </View>

        {/* Expenses */}
        <View className="mb-4">
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
              onPress={() => (isPro ? router.push(`/add-expense?jobId=${job.id}`) : router.push('/paywall'))}
              className="flex-row items-center px-4 min-h-[52px] active:opacity-70"
              accessibilityRole="button"
            >
              {isPro ? <Plus size={20} color={t.link} strokeWidth={2} /> : <Lock size={16} color={t.link} strokeWidth={2} />}
              <Text className="text-link text-base font-semibold ml-2">{isPro ? 'Add expense' : 'Add expenses with Pro'}</Text>
              {expensesTotal > 0 && (
                <Text className="ml-auto text-secondary text-[15px]">Total {formatAmount(expensesTotal)}</Text>
              )}
            </Pressable>
          </Group>
        </View>

        {/* A job that hasn't been invoiced can be deleted, e.g. when the customer says no */}
        {!hasInvoice && (
          <Group className="mt-4">
            <LinkRow icon={Trash2} label="Delete job" destructive onPress={() => setConfirmDelete(true)} />
          </Group>
        )}
      </ScrollView>

      {/* Next step */}
      {nextStep && (
        <View
          className="absolute left-0 right-0 bottom-0 bg-bg border-t border-divider px-4 pt-3"
          style={{ paddingBottom: insets.bottom + 12 }}
        >
          <PrimaryButton label={nextStep.label} onPress={nextStep.run} />
        </View>
      )}

      {/* Schedule */}
      <Sheet visible={showSchedule} onClose={() => setShowSchedule(false)}>
        <Text className="text-fg text-[17px] font-semibold text-center mb-4">Schedule job</Text>
        <Segmented
          className="mb-3 bg-bg"
          options={[
            {
              key: 'date',
              label: scheduleDate.toLocaleDateString(getRegion().locale, {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              }),
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
        <PrimaryButton label="Confirm" onPress={confirmSchedule} />
        <Pressable
          onPress={() => setShowSchedule(false)}
          className="min-h-[48px] items-center justify-center mt-1"
          accessibilityRole="button"
        >
          <Text className="text-secondary text-base font-semibold">Cancel</Text>
        </Pressable>
      </Sheet>

      {/* Mark done */}
      <Sheet visible={showComplete} onClose={() => setShowComplete(false)}>
        <Text className="text-fg text-[20px] font-semibold text-center">Mark this job done?</Text>
        <Text className="text-secondary text-[15px] text-center mt-1 mb-4">Next you can create the invoice.</Text>
        <View className="bg-bg rounded-2xl px-4 py-3 mb-4">
          <Line label="Job" value={label} />
          <Line label="Customer" value={customer.name} />
          {job.quote && <Line label="Quote" value={formatAmount(job.quote.total)} />}
          {parts.length > 0 && <Line label={`Parts (${parts.length})`} value={formatAmount(partsTotal)} />}
          {jobExpenses.length > 0 && <Line label={`Expenses (${jobExpenses.length})`} value={formatAmount(expensesTotal)} />}
          {(job.photos ?? []).length > 0 && <Line label="Photos" value={String((job.photos ?? []).length)} />}
        </View>
        {job.quote && partsTotal > job.quote.materials && (
          <Pressable
            onPress={() => {
              setShowComplete(false);
              setEditQuote({ labour: job.quote!.labour, materials: partsTotal, travel: job.quote!.travel });
            }}
            className="flex-row items-center mb-4 active:opacity-70"
            accessibilityRole="button"
          >
            <CircleAlert size={16} color={t.secondary} strokeWidth={2} />
            <Text className="flex-1 text-secondary text-[14px] ml-2">
              Your quote doesn’t include {formatAmount(partsTotal)} of parts.{' '}
              <Text className="text-link font-semibold">Add them to the price</Text>
            </Text>
          </Pressable>
        )}
        <PrimaryButton
          label="Mark done"
          onPress={async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            updateJob(job.id, {
              status: 'COMPLETED',
              completedAt: new Date().toISOString(),
            });
            toast('Job marked done');
            setShowComplete(false);
          }}
        />
        <Pressable
          onPress={() => setShowComplete(false)}
          className="min-h-[48px] items-center justify-center mt-1"
          accessibilityRole="button"
        >
          <Text className="text-secondary text-base font-semibold">Cancel</Text>
        </Pressable>
      </Sheet>

      {/* Edit quote */}
      {editQuote && job.quote && (
        <Sheet visible onClose={() => setEditQuote(null)}>
          <Text className="text-fg text-[20px] font-semibold mb-4">Edit quote</Text>
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
            label="Save quote"
            onPress={async () => {
              updateQuote(job.id, editQuote);
              toast('Quote updated');
              setEditQuote(null);
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }}
          />
          <Pressable
            onPress={() => setEditQuote(null)}
            className="min-h-[48px] items-center justify-center mt-1"
            accessibilityRole="button"
          >
            <Text className="text-secondary text-base font-semibold">Cancel</Text>
          </Pressable>
        </Sheet>
      )}

      {/* Edit job: type, description, urgency */}
      {editJob && (
        <Sheet visible onClose={() => setEditJob(null)}>
          <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets style={{ maxHeight: 640 }}>
            <Text className="text-fg text-[20px] font-semibold mb-4">Edit job</Text>
            <Text className="text-secondary text-[13px] mx-1 mb-1.5">Job type</Text>
            <Group className="bg-bg mb-4">
              {pricingPresets.map((p, i) => (
                <View key={p.type}>
                  {i > 0 && <RowDivider />}
                  <ChoiceRow
                    label={p.label}
                    selected={editJob.type === p.type}
                    onPress={() => setEditJob({ ...editJob, type: p.type })}
                  />
                </View>
              ))}
            </Group>
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
            {job.quote && !hasInvoice && (editJob.type !== job.type || editJob.urgency !== job.urgency) && (
              <Text className="text-secondary text-[13px] mx-1 mb-2">
                Labour changes to {formatAmount(calculateQuote(editJob.type, editJob.urgency).labour)}. Materials and travel stay
                as they are.
              </Text>
            )}
            <PrimaryButton
              label="Save"
              className="mt-3"
              onPress={async () => {
                const priceChanged = editJob.type !== job.type || editJob.urgency !== job.urgency;
                updateJob(job.id, { type: editJob.type, description: editJob.description.trim(), urgency: editJob.urgency });
                // A different job type or urgency means a different price, until it's on an invoice.
                if (priceChanged && job.quote && !hasInvoice) {
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
            <Pressable
              onPress={() => setEditJob(null)}
              className="min-h-[48px] items-center justify-center mt-1"
              accessibilityRole="button"
            >
              <Text className="text-secondary text-base font-semibold">Cancel</Text>
            </Pressable>
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
              label="Phone"
              value={editCustomer.phone}
              onChangeText={(v) => setEditCustomer({ ...editCustomer, phone: v })}
              placeholder="Phone"
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
              placeholder="Street"
              width="w-48"
            />
            <RowDivider />
            <FieldRow
              label={getRegion().postcodeLabel === 'ZIP code' ? 'ZIP code' : 'Postcode'}
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
              updateCustomer(customer.id, {
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
          <Pressable
            onPress={() => setEditCustomer(null)}
            className="min-h-[48px] items-center justify-center mt-1"
            accessibilityRole="button"
          >
            <Text className="text-secondary text-base font-semibold">Cancel</Text>
          </Pressable>
        </Sheet>
      )}

      <ConfirmModal
        visible={confirmQuoteSent}
        title="Did you send it?"
        message={`Mark the quote to ${customer.name} as sent?`}
        confirmText="Yes, mark as sent"
        cancelText="Not yet"
        onConfirm={() => {
          updateJob(job.id, {
            quoteSentAt: new Date().toISOString(),
            ...(job.status === 'REQUESTED' && { status: 'QUOTED' as const }),
          });
          toast('Quote marked as sent');
        }}
        onCancel={() => {}}
        onDismiss={() => setConfirmQuoteSent(false)}
      />

      <ConfirmModal
        visible={confirmCancelBooking}
        title="Cancel this booking?"
        message="The job stays, without a time, so you can book it again. Its reminder and calendar event are removed. Let the customer know yourself."
        confirmText="Cancel booking"
        cancelText="Keep it"
        variant="warning"
        onConfirm={async () => {
          await cancelJobReminder(job.id);
          await removeJobFromCalendar(job.id);
          updateJob(job.id, { status: 'APPROVED', acceptedAt: job.acceptedAt ?? new Date().toISOString(), scheduledDate: undefined, scheduledTime: undefined });
          toast('Booking cancelled');
        }}
        onCancel={() => {}}
        onDismiss={() => setConfirmCancelBooking(false)}
      />

      <ConfirmModal
        visible={confirmDelete}
        title="Delete this job?"
        message={`The job for ${customer.name} and its quote, parts, notes and photos will be deleted. This can’t be undone.`}
        confirmText="Delete job"
        cancelText="Cancel"
        variant="error"
        onConfirm={async () => {
          await cancelJobReminder(job.id);
          await removeJobFromCalendar(job.id);
          deleteJob(job.id);
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
