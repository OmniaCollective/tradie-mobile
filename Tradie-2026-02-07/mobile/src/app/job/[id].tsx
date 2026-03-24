import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  Linking,
  Share,
  Image,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Phone,
  MapPin,
  Clock,
  Calendar,
  MessageCircle,
  Play,
  Check,
  FileText,
  Send,
  Navigation,
  Bell,
  CalendarPlus,
  AlertCircle,
  Receipt,
  Plus,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTradeStore, useJobExpenses, JobStatus, EXPENSE_CATEGORY_LABELS } from '@/lib/store';
import { getJobTypeLabel } from '@/lib/trades';
import {
  scheduleJobReminder,
  sendBookingConfirmedNotification,
} from '@/lib/notifications';
import {
  syncJobToCalendar,
  requestCalendarPermissions,
  hasCalendarPermissions,
} from '@/lib/calendarSync';
import {
  sendCustomerReminder,
  sendQuoteFollowup,
  isQuoteExpiringSoon,
} from '@/lib/customerReminders';
import { ConfirmModal } from '@/components/ConfirmModal';

const TURQUOISE = '#14B8A6';

const statusLabels: Record<JobStatus, string> = {
  REQUESTED: 'Requested',
  QUOTED: 'Quoted',
  APPROVED: 'Approved',
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  INVOICED: 'Invoiced',
  PAID: 'Paid',
};

const statusColors: Record<JobStatus, string> = {
  REQUESTED: '#F59E0B',
  QUOTED: '#8B5CF6',
  APPROVED: '#10B981',
  SCHEDULED: '#3B82F6',
  IN_PROGRESS: TURQUOISE,
  COMPLETED: '#22C55E',
  INVOICED: '#F97316',
  PAID: '#10B981',
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { getJob, getCustomer, updateJob, createInvoice, settings, addPart, removePart, addPhoto, removePhoto } = useTradeStore();

  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [modal, setModal] = useState<{ title: string; message: string; variant?: 'default' | 'success' | 'error' | 'warning' } | null>(null);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState('');
  const [addingPart, setAddingPart] = useState(false);
  const [partName, setPartName] = useState('');
  const [partQty, setPartQty] = useState('');
  const [partCost, setPartCost] = useState('');
  const [photoTab, setPhotoTab] = useState<'before' | 'during' | 'after'>('before');
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [scheduleDate, setScheduleDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    return tomorrow;
  });
  const [schedulePickerMode, setSchedulePickerMode] = useState<'date' | 'time'>('date');
  const [showCompletionModal, setShowCompletionModal] = useState(false);

  const job = getJob(id);
  const customer = job ? getCustomer(job.customerId) : null;
  const jobExpenses = useJobExpenses(id);

  if (!job || !customer) {
    return (
      <View className="flex-1 bg-[#0F172A] items-center justify-center">
        <Text className="text-slate-500">Job not found</Text>
      </View>
    );
  }

  const statusColor = statusColors[job.status];

  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not scheduled';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  const handleAddPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsMultipleSelection: false,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // Copy to document directory for persistence
      const fileName = `photo_${Date.now()}.jpg`;
      const destDir = `${FileSystem.documentDirectory}job-photos/`;
      await FileSystem.makeDirectoryAsync(destDir, { intermediates: true });
      const destUri = `${destDir}${fileName}`;
      await FileSystem.copyAsync({ from: asset.uri, to: destUri });

      addPhoto(job.id, {
        uri: destUri,
        type: photoTab,
        createdAt: new Date().toISOString(),
      });
    }
  };

  const handleDeletePhoto = async (photoId: string, uri: string) => {
    removePhoto(job.id, photoId);
    try {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    } catch {}
  };

  const handleCall = () => {
    Linking.openURL(`tel:${customer.phone}`);
  };

  const handleMessage = () => {
    Linking.openURL(`sms:${customer.phone}`);
  };

  const handleNavigate = () => {
    const address = encodeURIComponent(`${customer.address}, ${customer.postcode}`);
    Linking.openURL(`https://maps.apple.com/?daddr=${address}`);
  };

  const handleStartJob = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateJob(job.id, { status: 'IN_PROGRESS' });
  };

  const handleCompleteJob = async () => {
    setShowCompletionModal(true);
  };

  const confirmCompleteJob = async () => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateJob(job.id, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
    });
    setShowCompletionModal(false);
  };

  const handleCreateInvoice = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const invoiceId = createInvoice(job.id);
    if (invoiceId) {
      router.push('/(tabs)/finances');
    }
  };

  const handleApproveQuote = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateJob(job.id, { status: 'APPROVED' });
  };

  const handleScheduleJob = () => {
    setShowSchedulePicker(true);
    setSchedulePickerMode('date');
  };

  const confirmScheduleJob = async () => {
    const scheduledDate = scheduleDate.toISOString().split('T')[0];
    const hours = scheduleDate.getHours().toString().padStart(2, '0');
    const minutes = scheduleDate.getMinutes().toString().padStart(2, '0');
    const scheduledTime = `${hours}:${minutes}`;

    setShowSchedulePicker(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateJob(job.id, {
      status: 'SCHEDULED',
      scheduledDate,
      scheduledTime,
    });

    // Send confirmation notification
    await sendBookingConfirmedNotification(
      customer.name,
      scheduledDate,
      scheduledTime
    );

    // Schedule reminder 1 hour before
    const jobLabel = getJobTypeLabel(settings.trade, job.type);
    await scheduleJobReminder(
      job.id,
      customer.name,
      jobLabel,
      scheduleDate,
      scheduledTime
    );

    // Sync to device calendar
    const hasPermission = await hasCalendarPermissions();
    if (hasPermission) {
      const updatedJob = { ...job, scheduledDate, scheduledTime, status: 'SCHEDULED' as JobStatus };
      await syncJobToCalendar(updatedJob, customer, jobLabel);
    }
  };

  const handleSyncToCalendar = async () => {
    setSyncingCalendar(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      let hasPermission = await hasCalendarPermissions();

      if (!hasPermission) {
        hasPermission = await requestCalendarPermissions();
        if (!hasPermission) {
          setModal({ title: 'Calendar Access Required', message: 'Please enable calendar access in Settings to sync jobs to your calendar.', variant: 'warning' });
          setSyncingCalendar(false);
          return;
        }
      }

      const jobLabel = getJobTypeLabel(settings.trade, job.type);
      const success = await syncJobToCalendar(job, customer, jobLabel);

      if (success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModal({ title: 'Synced', message: 'Job added to your calendar with reminders.', variant: 'success' });
      } else {
        setModal({ title: 'Error', message: 'Could not sync to calendar. Please try again.', variant: 'error' });
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
      setModal({ title: 'Error', message: 'Could not sync to calendar.', variant: 'error' });
    }

    setSyncingCalendar(false);
  };

  const handleSendCustomerReminder = async () => {
    setSendingReminder(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const jobLabel = getJobTypeLabel(settings.trade, job.type);
    const businessName = settings.businessName || 'TRADIE';

    // Determine reminder type based on scheduled date
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    let reminderType: 'day_before' | 'morning_of' = 'day_before';
    if (job.scheduledDate === today) {
      reminderType = 'morning_of';
    }

    const success = await sendCustomerReminder(
      customer,
      job,
      jobLabel,
      businessName,
      reminderType
    );

    if (success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setSendingReminder(false);
  };

  const handleSendQuoteFollowup = async () => {
    setSendingReminder(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const jobLabel = getJobTypeLabel(settings.trade, job.type);
    const businessName = settings.businessName || 'TRADIE';

    const success = await sendQuoteFollowup(customer, job, jobLabel, businessName);

    if (success) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    setSendingReminder(false);
  };

  return (
    <>
    <ScrollView className="flex-1 bg-[#0F172A]">
      <View className="px-4 pb-8">
        {/* Status Badge */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          className="flex-row items-center mb-4"
        >
          <View
            className="px-3 py-1.5 rounded-full"
            style={{ backgroundColor: `${statusColor}20` }}
          >
            <Text style={{ color: statusColor }} className="font-semibold text-sm">
              {statusLabels[job.status]}
            </Text>
          </View>
          {job.urgency === 'urgent' && (
            <View className="ml-2 px-3 py-1.5 rounded-full bg-[#F59E0B]/20">
              <Text className="text-[#F59E0B] font-semibold text-sm">Urgent</Text>
            </View>
          )}
          {job.urgency === 'emergency' && (
            <View className="ml-2 px-3 py-1.5 rounded-full bg-[#EF4444]/20">
              <Text className="text-[#EF4444] font-semibold text-sm">Emergency</Text>
            </View>
          )}
        </Animated.View>

        {/* Job Type & Description */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-6">
          <Text className="text-white font-bold text-2xl mb-2">
            {getJobTypeLabel(settings.trade, job.type)}
          </Text>
          <Text className="text-slate-400 text-base">{job.description}</Text>
        </Animated.View>

        {/* Customer Card */}
        <Animated.View
          entering={FadeInDown.delay(300).duration(400)}
          className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4 mb-4"
        >
          <Text className="text-slate-400 text-xs mb-3 uppercase tracking-wide">Customer</Text>
          <View className="flex-row items-center mb-4">
            <View className="w-12 h-12 rounded-full bg-[#334155] items-center justify-center mr-3">
              <Text className="text-white font-bold text-lg">
                {customer.name.charAt(0)}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-white font-bold text-lg">{customer.name}</Text>
              <View className="flex-row items-center mt-1">
                <MapPin size={14} color="#64748B" />
                <Text className="text-slate-500 text-sm ml-1">
                  {customer.address}, {customer.postcode}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Actions */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={handleCall}
              className="flex-1 bg-[#0F172A] rounded-xl py-3 flex-row items-center justify-center active:opacity-70"
            >
              <Phone size={18} color={TURQUOISE} />
              <Text className="text-white font-medium ml-2">Call</Text>
            </Pressable>
            <Pressable
              onPress={handleMessage}
              className="flex-1 bg-[#0F172A] rounded-xl py-3 flex-row items-center justify-center active:opacity-70"
            >
              <MessageCircle size={18} color={TURQUOISE} />
              <Text className="text-white font-medium ml-2">Text</Text>
            </Pressable>
            <Pressable
              onPress={handleNavigate}
              className="flex-1 bg-[#0F172A] rounded-xl py-3 flex-row items-center justify-center active:opacity-70"
            >
              <Navigation size={18} color={TURQUOISE} />
              <Text className="text-white font-medium ml-2">Navigate</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Schedule */}
        {job.scheduledDate && (
          <Animated.View
            entering={FadeInDown.delay(400).duration(400)}
            className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4 mb-4"
          >
            <Text className="text-slate-400 text-xs mb-3 uppercase tracking-wide">Schedule</Text>
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-[#0F172A] items-center justify-center mr-3">
                <Calendar size={20} color={TURQUOISE} />
              </View>
              <View>
                <Text className="text-white font-semibold">{formatDate(job.scheduledDate)}</Text>
                <View className="flex-row items-center mt-1">
                  <Clock size={14} color="#64748B" />
                  <Text className="text-slate-400 text-sm ml-1">
                    {formatTime(job.scheduledTime)}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Quote */}
        {job.quote && (
          <Animated.View
            entering={FadeInDown.delay(500).duration(400)}
            className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4 mb-4"
          >
            <Text className="text-slate-400 text-xs mb-3 uppercase tracking-wide">Quote</Text>
            <View className="bg-[#0F172A] rounded-xl p-3">
              <View className="flex-row justify-between mb-2">
                <Text className="text-slate-500">Labour</Text>
                <Text className="text-slate-300">£{job.quote.labour.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-slate-500">Materials</Text>
                <Text className="text-slate-300">£{job.quote.materials.toFixed(2)}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-slate-500">Travel</Text>
                <Text className="text-slate-300">£{job.quote.travel.toFixed(2)}</Text>
              </View>
              {job.quote.emergencySurcharge > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-500">Emergency Surcharge</Text>
                  <Text className="text-slate-300">£{job.quote.emergencySurcharge.toFixed(2)}</Text>
                </View>
              )}
              {job.quote.vat > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-500">VAT</Text>
                  <Text className="text-slate-300">£{job.quote.vat.toFixed(2)}</Text>
                </View>
              )}
              <View className="border-t border-[#334155] mt-2 pt-2 flex-row justify-between">
                <Text className="text-white font-bold">Total</Text>
                <Text className="text-[#14B8A6] font-bold text-xl">
                  £{job.quote.total.toFixed(2)}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Job Profitability — show on completed+ jobs with a quote */}
        {job.quote && ['COMPLETED', 'INVOICED', 'PAID'].includes(job.status) && (
          <Animated.View
            entering={FadeInDown.delay(525).duration(400)}
            className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4 mb-4"
          >
            <Text className="text-slate-400 text-xs mb-3 uppercase tracking-wide">Job Profit</Text>
            {(() => {
              const quoteTotal = job.quote!.total - job.quote!.vat; // ex-VAT revenue
              const partsTotal = (job.parts ?? []).reduce((s, p) => s + p.quantity * p.unitCost, 0);
              const expensesTotal = jobExpenses.reduce((s, e) => s + e.amount, 0);
              const totalCosts = partsTotal + expensesTotal;
              const profit = quoteTotal - totalCosts;
              const margin = quoteTotal > 0 ? (profit / quoteTotal) * 100 : 0;
              const isPositive = profit >= 0;

              return (
                <View className="bg-[#0F172A] rounded-xl p-3">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-slate-500 text-sm">Revenue (ex-VAT)</Text>
                    <Text className="text-slate-300 text-sm">£{quoteTotal.toFixed(2)}</Text>
                  </View>
                  {partsTotal > 0 && (
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500 text-sm">Parts ({(job.parts ?? []).length})</Text>
                      <Text className="text-slate-300 text-sm">−£{partsTotal.toFixed(2)}</Text>
                    </View>
                  )}
                  {expensesTotal > 0 && (
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500 text-sm">Expenses ({jobExpenses.length})</Text>
                      <Text className="text-slate-300 text-sm">−£{expensesTotal.toFixed(2)}</Text>
                    </View>
                  )}
                  <View className="border-t border-[#334155] mt-2 pt-2 flex-row justify-between items-center">
                    <View>
                      <Text className="text-white font-bold">Profit</Text>
                      {quoteTotal > 0 && (
                        <Text className="text-slate-500 text-xs">{margin.toFixed(0)}% margin</Text>
                      )}
                    </View>
                    <Text className={`font-bold text-xl ${isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                      {isPositive ? '' : '−'}£{Math.abs(profit).toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </Animated.View>
        )}

        {/* Parts & Materials */}
        <Animated.View
          entering={FadeInDown.delay(550).duration(400)}
          className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4 mb-4"
        >
          <Text className="text-slate-400 text-xs mb-3 uppercase tracking-wide">Parts & Materials</Text>

          {(job.parts ?? []).length > 0 ? (
            <View className="bg-[#0F172A] rounded-xl p-3 mb-3">
              {(job.parts ?? []).map((part) => (
                <View key={part.id} className="flex-row items-center justify-between mb-2">
                  <View className="flex-1 mr-2">
                    <Text className="text-white text-sm">{part.name}</Text>
                    <Text className="text-slate-500 text-xs">
                      {part.quantity} × £{part.unitCost.toFixed(2)}
                    </Text>
                  </View>
                  <Text className="text-slate-300 text-sm mr-3">
                    £{(part.quantity * part.unitCost).toFixed(2)}
                  </Text>
                  <Pressable onPress={() => removePart(job.id, part.id)}>
                    <Text className="text-red-400 text-xs">Remove</Text>
                  </Pressable>
                </View>
              ))}
              <View className="border-t border-[#334155] mt-1 pt-2 flex-row justify-between">
                <Text className="text-slate-400 text-sm">Parts Total</Text>
                <Text className="text-white font-semibold">
                  £{(job.parts ?? []).reduce((sum, p) => sum + p.quantity * p.unitCost, 0).toFixed(2)}
                </Text>
              </View>
            </View>
          ) : !addingPart ? (
            <Text className="text-slate-500 text-sm mb-3">No parts added yet</Text>
          ) : null}

          {addingPart ? (
            <View className="bg-[#0F172A] rounded-xl p-3">
              <TextInput
                value={partName}
                onChangeText={setPartName}
                placeholder="Part name"
                placeholderTextColor="#64748B"
                className="text-white text-sm bg-[#1E293B] rounded-lg px-3 py-2.5 mb-2"
              />
              <View className="flex-row gap-2 mb-3">
                <TextInput
                  value={partQty}
                  onChangeText={setPartQty}
                  placeholder="Qty"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  className="flex-1 text-white text-sm bg-[#1E293B] rounded-lg px-3 py-2.5"
                />
                <TextInput
                  value={partCost}
                  onChangeText={setPartCost}
                  placeholder="Unit cost (£)"
                  placeholderTextColor="#64748B"
                  keyboardType="decimal-pad"
                  className="flex-1 text-white text-sm bg-[#1E293B] rounded-lg px-3 py-2.5"
                />
              </View>
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => {
                    const qty = parseInt(partQty, 10);
                    const cost = parseFloat(partCost);
                    if (partName.trim() && qty > 0 && cost > 0) {
                      addPart(job.id, { name: partName.trim(), quantity: qty, unitCost: cost });
                      setPartName('');
                      setPartQty('');
                      setPartCost('');
                      setAddingPart(false);
                    }
                  }}
                  className="flex-1 bg-[#14B8A6] rounded-xl py-2.5 items-center active:opacity-80"
                >
                  <Text className="text-white font-bold text-sm">Save</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPartName('');
                    setPartQty('');
                    setPartCost('');
                    setAddingPart(false);
                  }}
                  className="flex-1 bg-[#0F172A] border border-[#334155] rounded-xl py-2.5 items-center active:opacity-80"
                >
                  <Text className="text-slate-400 font-medium text-sm">Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => setAddingPart(true)}
              className="bg-[#0F172A] rounded-xl py-3 items-center active:opacity-80"
            >
              <Text className="text-[#14B8A6] font-medium text-sm">Add Part</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Notes */}
        <Animated.View
          entering={FadeInDown.delay(650).duration(400)}
          className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4 mb-6"
        >
          <Text className="text-slate-400 text-xs mb-2 uppercase tracking-wide">Notes</Text>
          {editingNotes ? (
            <View>
              <TextInput
                value={notesText}
                onChangeText={setNotesText}
                multiline
                placeholder="Add notes..."
                placeholderTextColor="#64748B"
                className="text-white text-base min-h-[80px]"
                style={{ textAlignVertical: 'top' }}
                autoFocus
              />
              <View className="flex-row gap-3 mt-3">
                <Pressable
                  onPress={() => {
                    updateJob(job.id, { notes: notesText.trim() });
                    setEditingNotes(false);
                  }}
                  className="flex-1 bg-[#14B8A6] rounded-xl py-3 items-center active:opacity-80"
                >
                  <Text className="text-white font-bold">Save</Text>
                </Pressable>
                <Pressable
                  onPress={() => setEditingNotes(false)}
                  className="flex-1 bg-[#0F172A] rounded-xl py-3 items-center active:opacity-80"
                >
                  <Text className="text-slate-400 font-medium">Cancel</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setNotesText(job.notes || '');
                setEditingNotes(true);
              }}
            >
              <Text className={job.notes ? 'text-white' : 'text-slate-500'}>
                {job.notes || 'Tap to add notes...'}
              </Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Photos */}
        <Animated.View
          entering={FadeInDown.delay(700).duration(400)}
          className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4 mb-6"
        >
          <Text className="text-slate-400 text-xs mb-3 uppercase tracking-wide">Photos</Text>

          {/* Tab selector */}
          <View className="flex-row bg-[#0F172A] rounded-xl p-1 mb-3">
            {(['before', 'during', 'after'] as const).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setPhotoTab(tab)}
                className={`flex-1 py-2 rounded-lg items-center ${
                  photoTab === tab ? 'bg-[#1E293B]' : ''
                }`}
              >
                <Text
                  className={`text-sm font-medium capitalize ${
                    photoTab === tab ? 'text-white' : 'text-slate-500'
                  }`}
                >
                  {tab}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Photo grid */}
          {(() => {
            const filtered = (job.photos ?? []).filter((p) => p.type === photoTab);
            return filtered.length > 0 ? (
              <View className="flex-row flex-wrap gap-2 mb-3">
                {filtered.map((photo) => (
                  <Pressable
                    key={photo.id}
                    onLongPress={() => handleDeletePhoto(photo.id, photo.uri)}
                    className="rounded-xl overflow-hidden"
                    style={{ width: '48%', aspectRatio: 1 }}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="cover"
                    />
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text className="text-slate-500 text-sm mb-3">
                No {photoTab} photos yet
              </Text>
            );
          })()}

          <Pressable
            onPress={handleAddPhoto}
            className="bg-[#0F172A] rounded-xl py-3 items-center active:opacity-80"
          >
            <Text className="text-[#14B8A6] font-medium text-sm">Add Photo</Text>
          </Pressable>
        </Animated.View>

        {/* Linked Expenses */}
        <Animated.View
          entering={FadeInDown.delay(725).duration(400)}
          className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4 mb-6"
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-slate-400 text-xs uppercase tracking-wide">Expenses</Text>
            <Pressable
              onPress={() => router.push(`/add-expense?jobId=${job.id}`)}
              className="flex-row items-center active:opacity-70"
            >
              <Plus size={14} color={TURQUOISE} />
              <Text className="text-[#14B8A6] font-medium text-sm ml-1">Add</Text>
            </Pressable>
          </View>

          {jobExpenses.length === 0 ? (
            <Pressable
              onPress={() => router.push(`/add-expense?jobId=${job.id}`)}
              className="bg-[#0F172A] rounded-xl py-4 items-center active:opacity-80"
            >
              <Receipt size={20} color="#64748B" />
              <Text className="text-slate-500 text-sm mt-1">No expenses linked</Text>
            </Pressable>
          ) : (
            <View className="bg-[#0F172A] rounded-xl p-3">
              {jobExpenses.map((expense, i) => (
                <View key={expense.id} className={`flex-row items-center justify-between ${i < jobExpenses.length - 1 ? 'mb-2 pb-2 border-b border-[#334155]' : ''}`}>
                  <View className="flex-1 mr-2">
                    <Text className="text-white text-sm">{expense.description}</Text>
                    <Text className="text-slate-500 text-xs">{EXPENSE_CATEGORY_LABELS[expense.category]}</Text>
                  </View>
                  <Text className="text-slate-300 text-sm font-medium">£{expense.amount.toFixed(2)}</Text>
                </View>
              ))}
              <View className="border-t border-[#334155] mt-2 pt-2 flex-row justify-between">
                <Text className="text-slate-400 text-sm">Total</Text>
                <Text className="text-white font-semibold">
                  £{jobExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.delay(750).duration(400)} className="gap-3">
          {/* Quote expiry warning and followup */}
          {job.status === 'QUOTED' && isQuoteExpiringSoon(job) && (
            <View className="bg-[#F59E0B]/20 rounded-xl p-3 flex-row items-center mb-1">
              <AlertCircle size={18} color="#F59E0B" />
              <Text className="text-[#F59E0B] ml-2 flex-1">Quote expires soon</Text>
              <Pressable
                onPress={handleSendQuoteFollowup}
                disabled={sendingReminder}
                className="bg-[#F59E0B] px-3 py-1.5 rounded-lg active:opacity-80"
              >
                <Text className="text-white font-medium text-sm">
                  {sendingReminder ? 'Sending...' : 'Follow Up'}
                </Text>
              </Pressable>
            </View>
          )}

          {job.status === 'QUOTED' && (
            <>
              <Pressable
                onPress={handleApproveQuote}
                className="bg-[#14B8A6] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
              >
                <Check size={20} color="#FFF" />
                <Text className="text-white font-bold ml-2">Approve Quote</Text>
              </Pressable>
            </>
          )}

          {job.status === 'APPROVED' && (
            <Pressable
              onPress={handleScheduleJob}
              className="bg-[#14B8A6] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
            >
              <Calendar size={20} color="#FFF" />
              <Text className="text-white font-bold ml-2">Schedule Job</Text>
            </Pressable>
          )}

          {job.status === 'SCHEDULED' && (
            <>
              <Pressable
                onPress={handleStartJob}
                className="bg-[#14B8A6] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
              >
                <Play size={20} color="#FFF" />
                <Text className="text-white font-bold ml-2">Start Job</Text>
              </Pressable>

              {/* Calendar sync and customer reminder buttons */}
              <View className="flex-row gap-2">
                <Pressable
                  onPress={handleSyncToCalendar}
                  disabled={syncingCalendar}
                  className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl p-3 flex-row items-center justify-center active:opacity-80"
                >
                  <CalendarPlus size={18} color={TURQUOISE} />
                  <Text className="text-white font-medium ml-2 text-sm">
                    {syncingCalendar ? 'Syncing...' : 'Add to Calendar'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleSendCustomerReminder}
                  disabled={sendingReminder}
                  className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl p-3 flex-row items-center justify-center active:opacity-80"
                >
                  <Bell size={18} color={TURQUOISE} />
                  <Text className="text-white font-medium ml-2 text-sm">
                    {sendingReminder ? 'Sending...' : 'Remind Customer'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {job.status === 'IN_PROGRESS' && (
            <Pressable
              onPress={handleCompleteJob}
              className="bg-[#14B8A6] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
            >
              <Check size={20} color="#FFF" />
              <Text className="text-white font-bold ml-2">Mark Complete</Text>
            </Pressable>
          )}

          {job.status === 'COMPLETED' && (
            <Pressable
              onPress={handleCreateInvoice}
              className="bg-[#14B8A6] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
            >
              <FileText size={20} color="#FFF" />
              <Text className="text-white font-bold ml-2">Create Invoice</Text>
            </Pressable>
          )}
        </Animated.View>
      </View>
    </ScrollView>

      {/* Schedule Picker Modal */}
      {showSchedulePicker && (
        <Pressable
          onPress={() => setShowSchedulePicker(false)}
          className="absolute inset-0 bg-black/60 justify-end"
        >
          <Pressable onPress={() => {}} className="bg-[#1E293B] rounded-t-2xl border-t border-[#334155] p-4 pb-8">
            <Text className="text-white font-bold text-base mb-4 text-center">Schedule Job</Text>

            <View className="flex-row bg-[#0F172A] rounded-xl p-1 mb-4">
              <Pressable
                onPress={() => setSchedulePickerMode('date')}
                className={`flex-1 py-2.5 rounded-lg ${schedulePickerMode === 'date' ? 'bg-[#14B8A6]' : ''}`}
              >
                <Text className={`text-center font-semibold text-sm ${schedulePickerMode === 'date' ? 'text-white' : 'text-slate-400'}`}>
                  Date
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setSchedulePickerMode('time')}
                className={`flex-1 py-2.5 rounded-lg ${schedulePickerMode === 'time' ? 'bg-[#14B8A6]' : ''}`}
              >
                <Text className={`text-center font-semibold text-sm ${schedulePickerMode === 'time' ? 'text-white' : 'text-slate-400'}`}>
                  Time
                </Text>
              </Pressable>
            </View>

            <View className="bg-[#0F172A] rounded-xl mb-4 overflow-hidden">
              <DateTimePicker
                value={scheduleDate}
                mode={schedulePickerMode}
                display="spinner"
                minimumDate={new Date()}
                onChange={(_, d) => {
                  if (d) setScheduleDate(d);
                }}
                themeVariant="dark"
                accentColor={TURQUOISE}
                minuteInterval={15}
              />
            </View>

            <View className="bg-[#0F172A] rounded-xl p-3 mb-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Calendar size={16} color={TURQUOISE} />
                  <Text className="text-slate-300 text-sm ml-2">
                    {scheduleDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </Text>
                </View>
                <View className="flex-row items-center">
                  <Clock size={16} color={TURQUOISE} />
                  <Text className="text-slate-300 text-sm ml-2">
                    {formatTime(`${scheduleDate.getHours().toString().padStart(2, '0')}:${scheduleDate.getMinutes().toString().padStart(2, '0')}`)}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={confirmScheduleJob}
              className="bg-[#14B8A6] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
            >
              <Calendar size={18} color="#FFF" />
              <Text className="text-white font-bold ml-2">Confirm Schedule</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowSchedulePicker(false)}
              className="mt-3 p-3 active:opacity-70"
            >
              <Text className="text-slate-400 font-medium text-center">Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}

      {/* Completion Summary Modal */}
      {showCompletionModal && (
        <Pressable
          onPress={() => setShowCompletionModal(false)}
          className="absolute inset-0 bg-black/60 justify-end"
        >
          <Pressable onPress={() => {}} className="bg-[#1E293B] rounded-t-2xl border-t border-[#334155] p-4 pb-8">
            <View className="items-center mb-4">
              <View className="w-16 h-16 rounded-full bg-[#22C55E]/20 items-center justify-center mb-3">
                <Check size={32} color="#22C55E" />
              </View>
              <Text className="text-white font-bold text-lg">Complete Job?</Text>
              <Text className="text-slate-400 text-sm mt-1">Review the summary before completing</Text>
            </View>

            <View className="bg-[#0F172A] rounded-xl p-4 mb-4">
              <View className="flex-row justify-between mb-2">
                <Text className="text-slate-500 text-sm">Job</Text>
                <Text className="text-white text-sm font-medium">{getJobTypeLabel(settings.trade, job.type)}</Text>
              </View>
              <View className="flex-row justify-between mb-2">
                <Text className="text-slate-500 text-sm">Customer</Text>
                <Text className="text-white text-sm font-medium">{customer.name}</Text>
              </View>
              {job.scheduledDate && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-500 text-sm">Scheduled</Text>
                  <Text className="text-slate-300 text-sm">{formatDate(job.scheduledDate)}</Text>
                </View>
              )}
              {job.quote && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-500 text-sm">Quote</Text>
                  <Text className="text-[#14B8A6] text-sm font-bold">£{job.quote.total.toFixed(2)}</Text>
                </View>
              )}
              {(job.parts ?? []).length > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-500 text-sm">Parts ({(job.parts ?? []).length})</Text>
                  <Text className="text-slate-300 text-sm">
                    £{(job.parts ?? []).reduce((s, p) => s + p.quantity * p.unitCost, 0).toFixed(2)}
                  </Text>
                </View>
              )}
              {jobExpenses.length > 0 && (
                <View className="flex-row justify-between mb-2">
                  <Text className="text-slate-500 text-sm">Expenses ({jobExpenses.length})</Text>
                  <Text className="text-slate-300 text-sm">
                    £{jobExpenses.reduce((s, e) => s + e.amount, 0).toFixed(2)}
                  </Text>
                </View>
              )}
              {(job.photos ?? []).length > 0 && (
                <View className="flex-row justify-between">
                  <Text className="text-slate-500 text-sm">Photos</Text>
                  <Text className="text-slate-300 text-sm">{(job.photos ?? []).length}</Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={confirmCompleteJob}
              className="bg-[#22C55E] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
            >
              <Check size={18} color="#FFF" />
              <Text className="text-white font-bold ml-2">Mark Complete</Text>
            </Pressable>

            <Pressable
              onPress={() => setShowCompletionModal(false)}
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
