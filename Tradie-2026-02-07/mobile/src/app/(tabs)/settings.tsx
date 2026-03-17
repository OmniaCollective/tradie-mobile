import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Switch,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Building,
  Phone,
  Mail,
  MapPin,
  PoundSterling,
  Clock,
  Map,
  ChevronRight,
  Save,
  Crown,
  Sparkles,
  Calendar,
  Bell,
  CreditCard,
  CheckCircle,
  ExternalLink,
  AlertCircle,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTradeStore, useSettings, usePricingPresets, useJobs, JobType } from '@/lib/store';
import { hasEntitlement, isRevenueCatEnabled } from '@/lib/revenuecatClient';
import {
  requestCalendarPermissions,
  hasCalendarPermissions,
  syncAllJobsToCalendar,
} from '@/lib/calendarSync';
import { getJobTypeLabel } from '@/lib/trades';
import { scheduleReminderCheck } from '@/lib/customerReminders';
import { connectApi } from '@/lib/paymentsApi';
import { ConfirmModal } from '@/components/ConfirmModal';

const TURQUOISE = '#14B8A6';

export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettings();
  const pricingPresets = usePricingPresets();
  const jobs = useJobs();
  const { updateSettings, updatePricingPreset, getCustomer } = useTradeStore();

  const [showPricing, setShowPricing] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [dailyRemindersEnabled, setDailyRemindersEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Payment setup state
  const [paymentStatus, setPaymentStatus] = useState<'not_connected' | 'pending' | 'complete' | 'unavailable'>('not_connected');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [modal, setModal] = useState<{ title: string; message: string; variant?: 'default' | 'success' | 'error' | 'warning' } | null>(null);

  // Generate a consistent user ID for this device
  const getUserId = () => {
    // Use business name + phone as a simple unique identifier
    return `user_${settings.businessName.replace(/\s/g, '_')}_${settings.phone.replace(/\s/g, '')}` || 'default_user';
  };

  useEffect(() => {
    checkProStatus();
    checkCalendarPermissions();
    checkPaymentSetup();
  }, []);

  const checkPaymentSetup = async () => {
    setCheckingPayment(true);
    try {
      const userId = getUserId();
      const result = await connectApi.getStatus(userId);
      if (result.success) {
        if (result.status === 'complete') {
          setPaymentStatus('complete');
        } else if (result.connected) {
          setPaymentStatus('pending');
        } else {
          setPaymentStatus('not_connected');
        }
      } else {
        // Backend returned an error (network issue or not configured)
        setPaymentStatus('unavailable');
      }
    } catch (error) {
      console.error('Error checking payment setup:', error);
      setPaymentStatus('unavailable');
    } finally {
      setCheckingPayment(false);
    }
  };

  const checkProStatus = async () => {
    if (!isRevenueCatEnabled()) return;
    const result = await hasEntitlement('pro');
    if (result.ok) {
      setIsPro(result.data);
    }
  };

  const checkCalendarPermissions = async () => {
    const hasPermission = await hasCalendarPermissions();
    setCalendarEnabled(hasPermission);
  };

  const handleCalendarToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestCalendarPermissions();
      if (granted) {
        setCalendarEnabled(true);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Sync all existing scheduled jobs
        setSyncing(true);
        const { synced, failed } = await syncAllJobsToCalendar(
          jobs,
          getCustomer,
          (type) => getJobTypeLabel(settings.trade, type as JobType)
        );
        setSyncing(false);

        if (synced > 0) {
          setModal({ title: 'Calendar Synced', message: `${synced} job(s) added to your calendar.`, variant: 'success' });
        }
      } else {
        setModal({ title: 'Permission Required', message: 'Please enable calendar access in Settings to sync jobs.', variant: 'warning' });
      }
    } else {
      setCalendarEnabled(false);
    }
  };

  const handleDailyRemindersToggle = async (value: boolean) => {
    setDailyRemindersEnabled(value);
    if (value) {
      await scheduleReminderCheck();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModal({ title: 'Daily Reminders Enabled', message: "You'll get a reminder at 6 PM to send customer notifications for tomorrow's jobs.", variant: 'success' });
    }
  };

  const handleSetupPayments = async () => {
    setPaymentLoading(true);
    try {
      const userId = getUserId();
      const result = await connectApi.startOnboarding(
        userId,
        settings.email || undefined,
        settings.businessName || undefined
      );

      if (result.success) {
        if (result.status === 'complete') {
          setPaymentStatus('complete');
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setModal({ title: 'Already Set Up', message: 'Your payment account is ready to receive payments!', variant: 'success' });
        } else if (result.onboardingUrl) {
          // Open Stripe onboarding in browser
          await Linking.openURL(result.onboardingUrl);
          setPaymentStatus('pending');
        }
      } else {
        setModal({ title: 'Error', message: result.error || 'Failed to start payment setup', variant: 'error' });
      }
    } catch (error) {
      console.error('Error setting up payments:', error);
      setModal({ title: 'Error', message: 'Failed to start payment setup. Please try again.', variant: 'error' });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleOpenDashboard = async () => {
    setPaymentLoading(true);
    try {
      const userId = getUserId();
      const result = await connectApi.getDashboardLink(userId);

      if (result.success && result.dashboardUrl) {
        await Linking.openURL(result.dashboardUrl);
      } else {
        setModal({ title: 'Error', message: 'Failed to open dashboard', variant: 'error' });
      }
    } catch (error) {
      console.error('Error opening dashboard:', error);
      setModal({ title: 'Error', message: 'Failed to open dashboard', variant: 'error' });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleUpdateSetting = (key: keyof typeof settings, value: string | number) => {
    updateSettings({ [key]: value });
  };

  const handleUpdatePreset = (type: JobType, basePrice: number) => {
    updatePricingPreset(type, { basePrice });
  };

  return (<>
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView className="flex-1 bg-[#0F172A]">
        <View className="px-4 pb-8">
          {/* Pro Upgrade Banner */}
          {!isPro && (
            <Animated.View entering={FadeInDown.delay(50).duration(400)} className="mb-6">
              <Pressable
                onPress={() => router.push('/paywall')}
                className="bg-gradient-to-r from-[#14B8A6] to-[#0D9488] rounded-2xl p-4 active:opacity-90"
              >
                <View className="flex-row items-center">
                  <View className="w-12 h-12 rounded-full bg-white/20 items-center justify-center mr-4">
                    <Crown size={24} color="#FFF" fill="#FFF" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-white font-bold text-lg">Upgrade to Pro</Text>
                      <Sparkles size={16} color="#FCD34D" className="ml-2" />
                    </View>
                    <Text className="text-white/80 text-sm">
                      Unlimited bookings, analytics & more
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#FFF" />
                </View>
              </Pressable>
            </Animated.View>
          )}

          {/* Pro Badge if subscribed */}
          {isPro && (
            <Animated.View entering={FadeInDown.delay(50).duration(400)} className="mb-6">
              <View className="bg-[#14B8A6]/20 border border-[#14B8A6] rounded-2xl p-4">
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-full bg-[#14B8A6] items-center justify-center mr-3">
                    <Crown size={20} color="#FFF" fill="#FFF" />
                  </View>
                  <View>
                    <Text className="text-[#14B8A6] font-bold">TRADIE Pro</Text>
                    <Text className="text-slate-400 text-sm">All features unlocked</Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {/* Payment Setup */}
          <Animated.View entering={FadeInDown.delay(75).duration(400)} className="mb-6">
            <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
              Payment Setup
            </Text>
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              {checkingPayment ? (
                <View className="p-6 items-center">
                  <ActivityIndicator color={TURQUOISE} />
                  <Text className="text-slate-400 text-sm mt-2">Checking payment setup...</Text>
                </View>
              ) : paymentStatus === 'complete' ? (
                <View className="p-4">
                  <View className="flex-row items-center mb-4">
                    <View className="w-12 h-12 rounded-full bg-[#22C55E]/20 items-center justify-center">
                      <CheckCircle size={24} color="#22C55E" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-bold">Payments Active</Text>
                      <Text className="text-slate-400 text-sm">You can receive invoice payments</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={handleOpenDashboard}
                    disabled={paymentLoading}
                    className="bg-[#334155] rounded-xl p-3 flex-row items-center justify-center active:opacity-80"
                  >
                    {paymentLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <ExternalLink size={18} color="#FFF" />
                        <Text className="text-white font-medium ml-2">View Stripe Dashboard</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : paymentStatus === 'pending' ? (
                <View className="p-4">
                  <View className="flex-row items-center mb-4">
                    <View className="w-12 h-12 rounded-full bg-[#F59E0B]/20 items-center justify-center">
                      <AlertCircle size={24} color="#F59E0B" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-bold">Setup Incomplete</Text>
                      <Text className="text-slate-400 text-sm">Finish setting up to receive payments</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={handleSetupPayments}
                    disabled={paymentLoading}
                    className="bg-[#F59E0B] rounded-xl p-3 flex-row items-center justify-center active:opacity-80"
                  >
                    {paymentLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <CreditCard size={18} color="#FFF" />
                        <Text className="text-white font-bold ml-2">Continue Setup</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={checkPaymentSetup}
                    className="mt-2 p-2"
                  >
                    <Text className="text-slate-400 text-sm text-center">Tap to refresh status</Text>
                  </Pressable>
                </View>
              ) : paymentStatus === 'unavailable' ? (
                <View className="p-4">
                  <View className="flex-row items-center mb-3">
                    <View className="w-12 h-12 rounded-full bg-[#64748B]/20 items-center justify-center">
                      <CreditCard size={24} color="#64748B" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-bold">Payments Unavailable</Text>
                      <Text className="text-slate-400 text-sm">Could not connect to the payment server</Text>
                    </View>
                  </View>
                  <Text className="text-slate-500 text-xs mb-3">
                    You can still send invoices manually. Online payments require a backend server to be configured.
                  </Text>
                  <Pressable
                    onPress={checkPaymentSetup}
                    className="bg-[#334155] rounded-xl p-3 flex-row items-center justify-center active:opacity-80"
                  >
                    <Text className="text-slate-300 font-medium">Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="p-4">
                  <View className="flex-row items-center mb-4">
                    <View className="w-12 h-12 rounded-full bg-[#14B8A6]/20 items-center justify-center">
                      <CreditCard size={24} color={TURQUOISE} />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-bold">Set Up Payments</Text>
                      <Text className="text-slate-400 text-sm">Connect your bank to receive invoice payments</Text>
                    </View>
                  </View>
                  <Pressable
                    onPress={handleSetupPayments}
                    disabled={paymentLoading}
                    className="bg-[#14B8A6] rounded-xl p-3 flex-row items-center justify-center active:opacity-80"
                  >
                    {paymentLoading ? (
                      <ActivityIndicator color="#FFF" size="small" />
                    ) : (
                      <>
                        <CreditCard size={18} color="#FFF" />
                        <Text className="text-white font-bold ml-2">Connect Bank Account</Text>
                      </>
                    )}
                  </Pressable>
                  <Text className="text-slate-500 text-xs text-center mt-3">
                    Powered by Stripe. Your banking details are secure.
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Business Details */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-6">
            <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
              Business Details
            </Text>
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center mb-2">
                  <Building size={16} color="#64748B" />
                  <Text className="text-slate-400 text-xs ml-2">Business Name</Text>
                </View>
                <TextInput
                  className="text-white text-base"
                  value={settings.businessName}
                  onChangeText={(v) => handleUpdateSetting('businessName', v)}
                  placeholder="Your Business Name"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center mb-2">
                  <User size={16} color="#64748B" />
                  <Text className="text-slate-400 text-xs ml-2">Your Name</Text>
                </View>
                <TextInput
                  className="text-white text-base"
                  value={settings.ownerName}
                  onChangeText={(v) => handleUpdateSetting('ownerName', v)}
                  placeholder="Your Name"
                  placeholderTextColor="#64748B"
                />
              </View>

              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center mb-2">
                  <Phone size={16} color="#64748B" />
                  <Text className="text-slate-400 text-xs ml-2">Phone</Text>
                </View>
                <TextInput
                  className="text-white text-base"
                  value={settings.phone}
                  onChangeText={(v) => handleUpdateSetting('phone', v)}
                  placeholder="07700 000000"
                  placeholderTextColor="#64748B"
                  keyboardType="phone-pad"
                />
              </View>

              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center mb-2">
                  <Mail size={16} color="#64748B" />
                  <Text className="text-slate-400 text-xs ml-2">Email</Text>
                </View>
                <TextInput
                  className="text-white text-base"
                  value={settings.email}
                  onChangeText={(v) => handleUpdateSetting('email', v)}
                  placeholder="you@example.com"
                  placeholderTextColor="#64748B"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View className="p-4">
                <View className="flex-row items-center mb-2">
                  <MapPin size={16} color="#64748B" />
                  <Text className="text-slate-400 text-xs ml-2">Base Postcode</Text>
                </View>
                <TextInput
                  className="text-white text-base"
                  value={settings.postcode}
                  onChangeText={(v) => handleUpdateSetting('postcode', v.toUpperCase())}
                  placeholder="SW1A 1AA"
                  placeholderTextColor="#64748B"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </Animated.View>

          {/* Rates */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-6">
            <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
              Rates
            </Text>
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">Hourly Rate</Text>
                    <Text className="text-slate-500 text-xs">Base rate per hour</Text>
                  </View>
                  <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                    <Text className="text-slate-400 mr-1">£</Text>
                    <TextInput
                      className="text-white text-base w-16 text-right"
                      value={settings.hourlyRate.toString()}
                      onChangeText={(v) => handleUpdateSetting('hourlyRate', parseFloat(v) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">Minimum Charge</Text>
                    <Text className="text-slate-500 text-xs">Minimum job charge</Text>
                  </View>
                  <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                    <Text className="text-slate-400 mr-1">£</Text>
                    <TextInput
                      className="text-white text-base w-16 text-right"
                      value={settings.minimumCharge.toString()}
                      onChangeText={(v) => handleUpdateSetting('minimumCharge', parseFloat(v) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">Urgent Multiplier</Text>
                    <Text className="text-slate-500 text-xs">e.g. 1.5 = +50%</Text>
                  </View>
                  <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                    <TextInput
                      className="text-white text-base w-16 text-right"
                      value={settings.urgentMultiplier.toString()}
                      onChangeText={(v) => handleUpdateSetting('urgentMultiplier', parseFloat(v) || 1)}
                      keyboardType="numeric"
                    />
                    <Text className="text-slate-400 ml-1">x</Text>
                  </View>
                </View>
              </View>

              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">Emergency Multiplier</Text>
                    <Text className="text-slate-500 text-xs">e.g. 2 = +100%</Text>
                  </View>
                  <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                    <TextInput
                      className="text-white text-base w-16 text-right"
                      value={settings.emergencyMultiplier.toString()}
                      onChangeText={(v) => handleUpdateSetting('emergencyMultiplier', parseFloat(v) || 1)}
                      keyboardType="numeric"
                    />
                    <Text className="text-slate-400 ml-1">x</Text>
                  </View>
                </View>
              </View>

              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">Travel Rate</Text>
                    <Text className="text-slate-500 text-xs">Per mile</Text>
                  </View>
                  <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                    <Text className="text-slate-400 mr-1">£</Text>
                    <TextInput
                      className="text-white text-base w-16 text-right"
                      value={settings.travelRatePerMile.toString()}
                      onChangeText={(v) => handleUpdateSetting('travelRatePerMile', parseFloat(v) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              <View className="p-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">VAT Rate</Text>
                    <Text className="text-slate-500 text-xs">Percentage</Text>
                  </View>
                  <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                    <TextInput
                      className="text-white text-base w-16 text-right"
                      value={settings.vatRate.toString()}
                      onChangeText={(v) => handleUpdateSetting('vatRate', parseFloat(v) || 0)}
                      keyboardType="numeric"
                    />
                    <Text className="text-slate-400 ml-1">%</Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Job Pricing */}
          <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-6">
            <Pressable
              onPress={() => setShowPricing(!showPricing)}
              className="flex-row items-center justify-between mb-3"
            >
              <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wide">
                Job Pricing
              </Text>
              <ChevronRight
                size={20}
                color="#64748B"
                style={{ transform: [{ rotate: showPricing ? '90deg' : '0deg' }] }}
              />
            </Pressable>

            {showPricing && (
              <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
                {pricingPresets.map((preset, index) => (
                  <View
                    key={preset.type}
                    className={`p-4 ${
                      index < pricingPresets.length - 1 ? 'border-b border-[#334155]' : ''
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="text-white font-medium">{preset.label}</Text>
                      <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                        <Text className="text-slate-400 mr-1">£</Text>
                        <TextInput
                          className="text-white text-base w-16 text-right"
                          value={preset.basePrice.toString()}
                          onChangeText={(v) =>
                            handleUpdatePreset(preset.type, parseFloat(v) || 0)
                          }
                          keyboardType="numeric"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Service Area */}
          <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mb-6">
            <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
              Service Area
            </Text>
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Map size={20} color={TURQUOISE} />
                  <View className="ml-3">
                    <Text className="text-white font-medium">Service Radius</Text>
                    <Text className="text-slate-500 text-xs">Max distance from base</Text>
                  </View>
                </View>
                <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                  <TextInput
                    className="text-white text-base w-12 text-right"
                    value={settings.serviceRadiusMiles.toString()}
                    onChangeText={(v) =>
                      handleUpdateSetting('serviceRadiusMiles', parseFloat(v) || 0)
                    }
                    keyboardType="numeric"
                  />
                  <Text className="text-slate-400 ml-1">mi</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Working Hours */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)} className="mb-6">
            <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
              Working Hours
            </Text>
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center">
                  <Clock size={20} color={TURQUOISE} />
                  <Text className="text-white font-medium ml-3">Hours</Text>
                </View>
                <View className="flex-row items-center">
                  <TextInput
                    className="text-white text-base bg-[#0F172A] rounded-lg px-3 py-2 w-16 text-center"
                    value={settings.workingHours.start}
                    onChangeText={(v) =>
                      updateSettings({
                        workingHours: { ...settings.workingHours, start: v },
                      })
                    }
                    placeholder="08:00"
                    placeholderTextColor="#64748B"
                  />
                  <Text className="text-slate-400 mx-2">to</Text>
                  <TextInput
                    className="text-white text-base bg-[#0F172A] rounded-lg px-3 py-2 w-16 text-center"
                    value={settings.workingHours.end}
                    onChangeText={(v) =>
                      updateSettings({
                        workingHours: { ...settings.workingHours, end: v },
                      })
                    }
                    placeholder="18:00"
                    placeholderTextColor="#64748B"
                  />
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Automation */}
          <Animated.View entering={FadeInDown.delay(550).duration(400)} className="mb-6">
            <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
              Automation
            </Text>
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              {/* Calendar Sync */}
              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 mr-4">
                    <View className="w-10 h-10 rounded-full bg-[#14B8A6]/20 items-center justify-center">
                      <Calendar size={20} color={TURQUOISE} />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-medium">Calendar Sync</Text>
                      <Text className="text-slate-500 text-xs">
                        {syncing ? 'Syncing jobs...' : 'Add scheduled jobs to device calendar'}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={calendarEnabled}
                    onValueChange={handleCalendarToggle}
                    trackColor={{ false: '#334155', true: '#14B8A6' }}
                    thumbColor="#FFF"
                    disabled={syncing}
                  />
                </View>
              </View>

              {/* Daily Reminders */}
              <View className="p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 mr-4">
                    <View className="w-10 h-10 rounded-full bg-[#F59E0B]/20 items-center justify-center">
                      <Bell size={20} color="#F59E0B" />
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-white font-medium">Daily Reminders</Text>
                      <Text className="text-slate-500 text-xs">
                        Get reminded at 6 PM to notify customers
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={dailyRemindersEnabled}
                    onValueChange={handleDailyRemindersToggle}
                    trackColor={{ false: '#334155', true: '#F59E0B' }}
                    thumbColor="#FFF"
                  />
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Subscription Management */}
          {isPro && (
            <Animated.View entering={FadeInDown.delay(575).duration(400)} className="mb-6">
              <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
                Subscription
              </Text>
              <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
                <Pressable
                  onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
                  className="p-4 flex-row items-center justify-between active:opacity-80"
                >
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-[#14B8A6]/20 items-center justify-center">
                      <CreditCard size={20} color={TURQUOISE} />
                    </View>
                    <Text className="text-white font-medium ml-3">Manage Subscription</Text>
                  </View>
                  <ChevronRight size={18} color="#64748B" />
                </Pressable>
              </View>
            </Animated.View>
          )}

          {/* Legal */}
          <Animated.View entering={FadeInDown.delay(600).duration(400)} className="mb-6">
            <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
              Legal
            </Text>
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              <Pressable
                onPress={() => Linking.openURL('https://builtbyomnia.com/tradie/privacy-policy')}
                className="p-4 flex-row items-center justify-between border-b border-[#334155] active:opacity-80"
              >
                <Text className="text-white font-medium">Privacy Policy</Text>
                <ChevronRight size={18} color="#64748B" />
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL('https://builtbyomnia.com/tradie/terms-of-service')}
                className="p-4 flex-row items-center justify-between active:opacity-80"
              >
                <Text className="text-white font-medium">Terms of Service</Text>
                <ChevronRight size={18} color="#64748B" />
              </Pressable>
            </View>
          </Animated.View>

          {/* App Info */}
          <Animated.View entering={FadeInDown.delay(650).duration(400)}>
            <View className="items-center py-6">
              <Text className="text-[#14B8A6] font-bold text-2xl">TRADIE</Text>
              <Text className="text-slate-500 text-sm mt-1">v1.0.2</Text>
              <Text className="text-slate-600 text-xs mt-1">paul@builtbyomnia.com</Text>
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

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
