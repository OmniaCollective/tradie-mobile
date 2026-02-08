import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  Share,
  Alert,
} from 'react-native';
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
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTradeStore, JobStatus } from '@/lib/store';
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
  const { getJob, getCustomer, updateJob, createInvoice, settings } = useTradeStore();

  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);

  const job = getJob(id);
  const customer = job ? getCustomer(job.customerId) : null;

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
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateJob(job.id, {
      status: 'COMPLETED',
      completedAt: new Date().toISOString(),
    });
  };

  const handleCreateInvoice = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const invoiceId = createInvoice(job.id);
    if (invoiceId) {
      router.push('/invoices');
    }
  };

  const handleApproveQuote = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateJob(job.id, { status: 'APPROVED' });
  };

  const handleScheduleJob = async () => {
    // For now, schedule for tomorrow at 10am
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const scheduledDate = tomorrow.toISOString().split('T')[0];
    const scheduledTime = '10:00';

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
      tomorrow,
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
          Alert.alert(
            'Calendar Access Required',
            'Please enable calendar access in Settings to sync jobs to your calendar.'
          );
          setSyncingCalendar(false);
          return;
        }
      }

      const jobLabel = getJobTypeLabel(settings.trade, job.type);
      const success = await syncJobToCalendar(job, customer, jobLabel);

      if (success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Synced', 'Job added to your calendar with reminders.');
      } else {
        Alert.alert('Error', 'Could not sync to calendar. Please try again.');
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
      Alert.alert('Error', 'Could not sync to calendar.');
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
              <View className="flex-row justify-between mb-2">
                <Text className="text-slate-500">VAT</Text>
                <Text className="text-slate-300">£{job.quote.vat.toFixed(2)}</Text>
              </View>
              <View className="border-t border-[#334155] mt-2 pt-2 flex-row justify-between">
                <Text className="text-white font-bold">Total</Text>
                <Text className="text-[#14B8A6] font-bold text-xl">
                  £{job.quote.total.toFixed(2)}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Notes */}
        {job.notes && (
          <Animated.View
            entering={FadeInDown.delay(600).duration(400)}
            className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4 mb-6"
          >
            <Text className="text-slate-400 text-xs mb-2 uppercase tracking-wide">Notes</Text>
            <Text className="text-white">{job.notes}</Text>
          </Animated.View>
        )}

        {/* Action Buttons */}
        <Animated.View entering={FadeInDown.delay(700).duration(400)} className="gap-3">
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
  );
}
