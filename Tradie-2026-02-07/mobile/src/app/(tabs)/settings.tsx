import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Switch,
  ActivityIndicator,
  Linking,
  Modal,
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
  Calendar,
  Bell,
  CreditCard,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  Database,
  Trash2,
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
import { TURQUOISE, GREEN, AMBER, BORDER, SLATE_500, SLATE_600, RED, WHITE } from '@/lib/theme';


export default function SettingsScreen() {
  const router = useRouter();
  const settings = useSettings();
  const pricingPresets = usePricingPresets();
  const jobs = useJobs();
  const { updateSettings, updatePricingPreset, getCustomer, loadSampleData, clearAllData } = useTradeStore();

  const [showPricing, setShowPricing] = useState(false);
  const [showBusiness, setShowBusiness] = useState(true);
  const [showRates, setShowRates] = useState(false);
  const [showTax, setShowTax] = useState(false);
  const [showServiceArea, setShowServiceArea] = useState(false);
  const [showWorkingHours, setShowWorkingHours] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [calendarEnabled, setCalendarEnabled] = useState(false);
  const [dailyRemindersEnabled, setDailyRemindersEnabled] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Payment setup state
  const [paymentStatus, setPaymentStatus] = useState<'not_connected' | 'pending' | 'complete' | 'unavailable'>('not_connected');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(true);
  const [modal, setModal] = useState<{ title: string; message: string; variant?: 'default' | 'success' | 'error' | 'warning' } | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmText: string; variant: 'default' | 'success' | 'error' | 'warning'; onConfirm: () => void } | null>(null);
  const [simpleAlert, setSimpleAlert] = useState<string | null>(null);

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
      if (__DEV__) console.error('Error checking payment setup:', error);
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
      if (__DEV__) console.error('Error setting up payments:', error);
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
      if (__DEV__) console.error('Error opening dashboard:', error);
      setModal({ title: 'Error', message: 'Failed to open dashboard', variant: 'error' });
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleUpdateSetting = (key: keyof typeof settings, value: string | number | boolean) => {
    updateSettings({ [key]: value });
  };

  const handleUpdatePreset = (type: JobType, basePrice: number) => {
    updatePricingPreset(type, { basePrice });
  };

  return (<>
      <ScrollView
        className="flex-1 bg-[#0F172A]"
        automaticallyAdjustKeyboardInsets={true}
        keyboardShouldPersistTaps="handled"
      >
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
                    <Crown size={24} color={WHITE} fill={WHITE} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-white font-bold text-lg">Upgrade to Pro</Text>
                    </View>
                    <Text className="text-white/80 text-sm">
                      Unlimited bookings, analytics & more
                    </Text>
                  </View>
                  <ChevronRight size={20} color={WHITE} />
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
                    <Crown size={20} color={WHITE} fill={WHITE} />
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
                      <CheckCircle size={24} color={GREEN} />
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
                      <ActivityIndicator color={WHITE} size="small" />
                    ) : (
                      <>
                        <ExternalLink size={18} color={WHITE} />
                        <Text className="text-white font-medium ml-2">View Stripe Dashboard</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              ) : paymentStatus === 'pending' ? (
                <View className="p-4">
                  <View className="flex-row items-center mb-4">
                    <View className="w-12 h-12 rounded-full bg-[#F59E0B]/20 items-center justify-center">
                      <AlertCircle size={24} color={AMBER} />
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
                      <ActivityIndicator color={WHITE} size="small" />
                    ) : (
                      <>
                        <CreditCard size={18} color={WHITE} />
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
                      <CreditCard size={24} color={SLATE_500} />
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
                      <ActivityIndicator color={WHITE} size="small" />
                    ) : (
                      <>
                        <CreditCard size={18} color={WHITE} />
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
            <Pressable
              onPress={() => setShowBusiness(!showBusiness)}
              className="flex-row items-center justify-between mb-3"
            >
              <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wide">
                Business Details
              </Text>
              <ChevronRight
                size={20}
                color={SLATE_500}
                style={{ transform: [{ rotate: showBusiness ? '90deg' : '0deg' }] }}
              />
            </Pressable>
            {showBusiness && <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center mb-2">
                  <Building size={16} color={SLATE_500} />
                  <Text className="text-slate-400 text-xs ml-2">Business Name</Text>
                </View>
                <TextInput
                  className="text-white text-base"
                  value={settings.businessName}
                  onChangeText={(v) => handleUpdateSetting('businessName', v)}
                  placeholder="Your Business Name"
                  placeholderTextColor={SLATE_500}
                />
              </View>

              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center mb-2">
                  <User size={16} color={SLATE_500} />
                  <Text className="text-slate-400 text-xs ml-2">Your Name</Text>
                </View>
                <TextInput
                  className="text-white text-base"
                  value={settings.ownerName}
                  onChangeText={(v) => handleUpdateSetting('ownerName', v)}
                  placeholder="Your Name"
                  placeholderTextColor={SLATE_500}
                />
              </View>

              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center mb-2">
                  <Phone size={16} color={SLATE_500} />
                  <Text className="text-slate-400 text-xs ml-2">Phone</Text>
                </View>
                <TextInput
                  className="text-white text-base"
                  value={settings.phone}
                  onChangeText={(v) => handleUpdateSetting('phone', v)}
                  placeholder="07700 000000"
                  placeholderTextColor={SLATE_500}
                  keyboardType="phone-pad"
                />
              </View>

              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center mb-2">
                  <Mail size={16} color={SLATE_500} />
                  <Text className="text-slate-400 text-xs ml-2">Email</Text>
                </View>
                <TextInput
                  className="text-white text-base"
                  value={settings.email}
                  onChangeText={(v) => handleUpdateSetting('email', v)}
                  placeholder="you@example.com"
                  placeholderTextColor={SLATE_500}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View className="p-4">
                <View className="flex-row items-center mb-2">
                  <MapPin size={16} color={SLATE_500} />
                  <Text className="text-slate-400 text-xs ml-2">Base Postcode</Text>
                </View>
                <TextInput
                  className="text-white text-base"
                  value={settings.postcode}
                  onChangeText={(v) => handleUpdateSetting('postcode', v.toUpperCase())}
                  placeholder="SW1A 1AA"
                  placeholderTextColor={SLATE_500}
                  autoCapitalize="characters"
                />
              </View>
            </View>}
          </Animated.View>

          {/* Rates */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-6">
            <Pressable
              onPress={() => setShowRates(!showRates)}
              className="flex-row items-center justify-between mb-3"
            >
              <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wide">
                Rates
              </Text>
              <ChevronRight
                size={20}
                color={SLATE_500}
                style={{ transform: [{ rotate: showRates ? '90deg' : '0deg' }] }}
              />
            </Pressable>
            {showRates && <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
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

              <View className="p-4">
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

            </View>}
          </Animated.View>

          {/* Tax & Finance */}
          <Animated.View entering={FadeInDown.delay(250).duration(400)} className="mb-6">
            <Pressable
              onPress={() => setShowTax(!showTax)}
              className="flex-row items-center justify-between mb-3"
            >
              <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wide">
                Tax & Finance
              </Text>
              <ChevronRight
                size={20}
                color={SLATE_500}
                style={{ transform: [{ rotate: showTax ? '90deg' : '0deg' }] }}
              />
            </Pressable>
            {showTax && <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              {/* VAT Registered */}
              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">VAT Registered</Text>
                    <Text className="text-slate-500 text-xs">Are you registered for VAT?</Text>
                  </View>
                  <Switch
                    value={settings.vatRegistered}
                    onValueChange={(v) => handleUpdateSetting('vatRegistered', v)}
                    trackColor={{ false: BORDER, true: TURQUOISE }}
                    thumbColor={WHITE}
                  />
                </View>
              </View>

              {/* VAT Details — only when registered */}
              {settings.vatRegistered && (
                <>
                  <View className="p-4 border-b border-[#334155]">
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-white font-medium">VAT Number</Text>
                        <Text className="text-slate-500 text-xs">Your VAT registration number</Text>
                      </View>
                      <TextInput
                        className="text-white text-base bg-[#0F172A] rounded-xl px-3 py-2 w-36 text-right"
                        value={settings.vatNumber}
                        onChangeText={(v) => handleUpdateSetting('vatNumber', v)}
                        placeholder="GB 123 4567 89"
                        placeholderTextColor={SLATE_600}
                      />
                    </View>
                  </View>

                  <View className="p-4 border-b border-[#334155]">
                    <View className="flex-row items-center justify-between">
                      <View>
                        <Text className="text-white font-medium">VAT Rate</Text>
                        <Text className="text-slate-500 text-xs">Standard rate</Text>
                      </View>
                      <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                        <TextInput
                          className="text-white text-base w-12 text-right"
                          value={settings.vatRate.toString()}
                          onChangeText={(v) => handleUpdateSetting('vatRate', parseFloat(v) || 0)}
                          keyboardType="numeric"
                        />
                        <Text className="text-slate-400 ml-1">%</Text>
                      </View>
                    </View>
                  </View>

                  <View className="p-4 border-b border-[#334155]">
                    <Text className="text-white font-medium mb-2">VAT Scheme</Text>
                    <View className="flex-row gap-2">
                      <Pressable
                        onPress={() => handleUpdateSetting('vatScheme', 'standard')}
                        className={`flex-1 rounded-lg p-3 items-center border ${
                          settings.vatScheme === 'standard' ? 'border-[#14B8A6] bg-[#14B8A6]/10' : 'border-[#334155]'
                        }`}
                      >
                        <Text className={`text-sm font-medium ${
                          settings.vatScheme === 'standard' ? 'text-[#14B8A6]' : 'text-slate-500'
                        }`}>Standard</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => handleUpdateSetting('vatScheme', 'flat_rate')}
                        className={`flex-1 rounded-lg p-3 items-center border ${
                          settings.vatScheme === 'flat_rate' ? 'border-[#14B8A6] bg-[#14B8A6]/10' : 'border-[#334155]'
                        }`}
                      >
                        <Text className={`text-sm font-medium ${
                          settings.vatScheme === 'flat_rate' ? 'text-[#14B8A6]' : 'text-slate-500'
                        }`}>Flat Rate</Text>
                      </Pressable>
                    </View>
                    {settings.vatScheme === 'flat_rate' && (
                      <View className="flex-row items-center justify-between mt-3">
                        <Text className="text-slate-400 text-sm">Flat rate percentage</Text>
                        <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                          <TextInput
                            className="text-white text-base w-12 text-right"
                            value={settings.vatFlatRatePercent.toString()}
                            onChangeText={(v) => handleUpdateSetting('vatFlatRatePercent', parseFloat(v) || 0)}
                            keyboardType="numeric"
                          />
                          <Text className="text-slate-400 ml-1">%</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </>
              )}

              {/* CIS */}
              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">CIS Registered</Text>
                    <Text className="text-slate-500 text-xs">Construction Industry Scheme</Text>
                  </View>
                  <Switch
                    value={settings.cisRegistered}
                    onValueChange={(v) => handleUpdateSetting('cisRegistered', v)}
                    trackColor={{ false: BORDER, true: TURQUOISE }}
                    thumbColor={WHITE}
                  />
                </View>
              </View>

              {settings.cisRegistered && (
                <View className="p-4 border-b border-[#334155]">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-white font-medium">CIS Deduction Rate</Text>
                      <Text className="text-slate-500 text-xs">Standard 20%, verified 30%</Text>
                    </View>
                    <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                      <TextInput
                        className="text-white text-base w-12 text-right"
                        value={(settings.cisRate ?? 20).toString()}
                        onChangeText={(v) => handleUpdateSetting('cisRate', parseFloat(v) || 0)}
                        keyboardType="numeric"
                      />
                      <Text className="text-slate-400 ml-1">%</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Personal Allowance */}
              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">Personal Allowance</Text>
                    <Text className="text-slate-500 text-xs">Tax-free amount (£12,570)</Text>
                  </View>
                  <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                    <Text className="text-slate-400 mr-1">£</Text>
                    <TextInput
                      className="text-white text-base w-20 text-right"
                      value={settings.personalAllowance.toString()}
                      onChangeText={(v) => handleUpdateSetting('personalAllowance', parseFloat(v) || 0)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>

              {/* Only Income Source */}
              <View className="p-4 border-b border-[#334155]">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">Only Income Source</Text>
                    <Text className="text-slate-500 text-xs">Is this your only income?</Text>
                  </View>
                  <Switch
                    value={settings.onlyIncomeSource}
                    onValueChange={(v) => handleUpdateSetting('onlyIncomeSource', v)}
                    trackColor={{ false: BORDER, true: TURQUOISE }}
                    thumbColor={WHITE}
                  />
                </View>
              </View>

              {/* Other Income — only when not only source */}
              {!settings.onlyIncomeSource && (
                <View className="p-4 border-b border-[#334155]">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <Text className="text-white font-medium">Other Annual Income</Text>
                      <Text className="text-slate-500 text-xs">PAYE salary or other income</Text>
                    </View>
                    <View className="flex-row items-center bg-[#0F172A] rounded-xl px-3 py-2">
                      <Text className="text-slate-400 mr-1">£</Text>
                      <TextInput
                        className="text-white text-base w-20 text-right"
                        value={settings.otherAnnualIncome.toString()}
                        onChangeText={(v) => handleUpdateSetting('otherAnnualIncome', parseFloat(v) || 0)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              )}

              {/* Mileage Rate — HMRC fixed */}
              <View className="p-4">
                <View className="flex-row items-center justify-between">
                  <View>
                    <Text className="text-white font-medium">Mileage Rate</Text>
                    <Text className="text-slate-500 text-xs">HMRC approved rates</Text>
                  </View>
                  <View>
                    <Text className="text-slate-300 text-sm text-right">45p/mile (first 10k)</Text>
                    <Text className="text-slate-500 text-xs text-right">25p/mile (after 10k)</Text>
                  </View>
                </View>
              </View>
            </View>}
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
                color={SLATE_500}
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
            <Pressable
              onPress={() => setShowServiceArea(!showServiceArea)}
              className="flex-row items-center justify-between mb-3"
            >
              <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wide">
                Service Area
              </Text>
              <ChevronRight
                size={20}
                color={SLATE_500}
                style={{ transform: [{ rotate: showServiceArea ? '90deg' : '0deg' }] }}
              />
            </Pressable>
            {showServiceArea && <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4">
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
            </View>}
          </Animated.View>

          {/* Working Hours */}
          <Animated.View entering={FadeInDown.delay(500).duration(400)} className="mb-6">
            <Pressable
              onPress={() => setShowWorkingHours(!showWorkingHours)}
              className="flex-row items-center justify-between mb-3"
            >
              <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wide">
                Working Hours
              </Text>
              <ChevronRight
                size={20}
                color={SLATE_500}
                style={{ transform: [{ rotate: showWorkingHours ? '90deg' : '0deg' }] }}
              />
            </Pressable>
            {showWorkingHours && <View className="bg-[#1E293B] rounded-2xl border border-[#334155] p-4">
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
                    placeholderTextColor={SLATE_500}
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
                    placeholderTextColor={SLATE_500}
                  />
                </View>
              </View>
            </View>}
          </Animated.View>

          {/* Automation */}
          <Animated.View entering={FadeInDown.delay(550).duration(400)} className="mb-6">
            <Pressable
              onPress={() => setShowAutomation(!showAutomation)}
              className="flex-row items-center justify-between mb-3"
            >
              <Text className="text-slate-400 text-sm font-semibold uppercase tracking-wide">
                Automation
              </Text>
              <ChevronRight
                size={20}
                color={SLATE_500}
                style={{ transform: [{ rotate: showAutomation ? '90deg' : '0deg' }] }}
              />
            </Pressable>
            {showAutomation && <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
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
                    trackColor={{ false: BORDER, true: TURQUOISE }}
                    thumbColor={WHITE}
                    disabled={syncing}
                  />
                </View>
              </View>

              {/* Daily Reminders */}
              <View className="p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1 mr-4">
                    <View className="w-10 h-10 rounded-full bg-[#F59E0B]/20 items-center justify-center">
                      <Bell size={20} color={AMBER} />
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
                    trackColor={{ false: BORDER, true: AMBER }}
                    thumbColor={WHITE}
                  />
                </View>
              </View>
            </View>}
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
                  <ChevronRight size={18} color={SLATE_500} />
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
                <ChevronRight size={18} color={SLATE_500} />
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL('https://builtbyomnia.com/tradie/terms-of-service')}
                className="p-4 flex-row items-center justify-between active:opacity-80"
              >
                <Text className="text-white font-medium">Terms of Service</Text>
                <ChevronRight size={18} color={SLATE_500} />
              </Pressable>
            </View>
          </Animated.View>

          {/* Data */}
          <Animated.View entering={FadeInDown.delay(625).duration(400)} className="mb-6">
            <Text className="text-slate-400 text-sm font-semibold mb-3 uppercase tracking-wide">
              Data
            </Text>
            <View className="bg-[#1E293B] rounded-2xl border border-[#334155] overflow-hidden">
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setTimeout(() => { loadSampleData(); setSimpleAlert('Sample data loaded'); }, 100);
                }}
                className="p-4 flex-row items-center justify-between border-b border-[#334155] active:opacity-80"
              >
                <View className="flex-row items-center gap-3">
                  <Database size={18} color={TURQUOISE} />
                  <Text className="text-white font-medium">Load Sample Data</Text>
                </View>
                <ChevronRight size={18} color={SLATE_500} />
              </Pressable>
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setTimeout(() => { clearAllData(); setSimpleAlert('All data cleared'); }, 100);
                }}
                className="p-4 flex-row items-center justify-between active:opacity-80"
              >
                <View className="flex-row items-center gap-3">
                  <Trash2 size={18} color={RED} />
                  <Text className="text-red-400 font-medium">Clear All Data</Text>
                </View>
                <ChevronRight size={18} color={SLATE_500} />
              </Pressable>
            </View>
          </Animated.View>

          {/* App Info */}
          <Animated.View entering={FadeInDown.delay(650).duration(400)}>
            <View className="items-center py-6">
              <Text className="text-[#14B8A6] font-bold text-2xl">TRADIE</Text>
              <Text className="text-slate-500 text-sm mt-1">v1.5.0</Text>
              <Text className="text-slate-600 text-xs mt-1">paul@builtbyomnia.com</Text>
            </View>
          </Animated.View>
        </View>
      </ScrollView>

      {modal && (
        <ConfirmModal
          visible={!!modal}
          title={modal.title}
          message={modal.message}
          variant={modal.variant}
          onDismiss={() => setModal(null)}
        />
      )}

      {confirm && (
        <ConfirmModal
          visible={!!confirm}
          title={confirm.title}
          message={confirm.message}
          confirmText={confirm.confirmText}
          cancelText="Cancel"
          variant={confirm.variant}
          onConfirm={confirm.onConfirm}
          onCancel={() => {}}
          onDismiss={() => setConfirm(null)}
        />
      )}

      <Modal visible={!!simpleAlert} transparent animationType="fade" onRequestClose={() => setSimpleAlert(null)}>
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-[#1E293B] rounded-2xl px-6 py-5 mx-8 border border-[#334155]">
            <Text className="text-white font-semibold text-base text-center mb-4">{simpleAlert}</Text>
            <Pressable onPress={() => setSimpleAlert(null)} className="bg-[#334155] rounded-xl py-3 items-center active:opacity-70">
              <Text className="text-white font-medium">OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

    </>
  );
}
