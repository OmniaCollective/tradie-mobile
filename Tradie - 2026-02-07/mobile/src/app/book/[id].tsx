import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Wrench,
  ChevronRight,
  Check,
  Clock,
  Calendar,
  MapPin,
  User,
  Phone,
  Mail,
  AlertTriangle,
  Zap,
  Shield,
  XCircle,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { useTradeStore, JobType, Urgency } from '@/lib/store';
import { sendNewBookingNotification } from '@/lib/notifications';
import { FREE_TIER_LIMITS } from '@/lib/useProAccess';
import { hasEntitlement, isRevenueCatEnabled } from '@/lib/revenuecatClient';

const TURQUOISE = '#14B8A6';

type Step = 'issue' | 'details' | 'confirm' | 'success' | 'limit_reached';

interface JobOption {
  type: JobType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const jobOptions: JobOption[] = [
  {
    type: 'blocked_drain',
    label: 'Blocked Drain',
    description: 'Sink, bath, or shower draining slowly or not at all',
    icon: <Wrench size={24} color={TURQUOISE} />,
  },
  {
    type: 'leaking_tap',
    label: 'Leaking Tap',
    description: 'Dripping or running tap that won\'t stop',
    icon: <Wrench size={24} color={TURQUOISE} />,
  },
  {
    type: 'burst_pipe',
    label: 'Burst Pipe',
    description: 'Water leaking from pipes',
    icon: <Wrench size={24} color={TURQUOISE} />,
  },
  {
    type: 'toilet_repair',
    label: 'Toilet Repair',
    description: 'Toilet running, leaking, or not flushing',
    icon: <Wrench size={24} color={TURQUOISE} />,
  },
  {
    type: 'boiler_service',
    label: 'Boiler Service',
    description: 'Annual service or boiler issues',
    icon: <Wrench size={24} color={TURQUOISE} />,
  },
  {
    type: 'radiator_issue',
    label: 'Radiator Issue',
    description: 'Cold spots, leaks, or not heating',
    icon: <Wrench size={24} color={TURQUOISE} />,
  },
  {
    type: 'water_heater',
    label: 'Water Heater',
    description: 'No hot water or heater problems',
    icon: <Wrench size={24} color={TURQUOISE} />,
  },
  {
    type: 'general_plumbing',
    label: 'Other Plumbing',
    description: 'Something else not listed here',
    icon: <Wrench size={24} color={TURQUOISE} />,
  },
];

const urgencyOptions: Array<{ value: Urgency; label: string; description: string; icon: React.ReactNode }> = [
  {
    value: 'standard',
    label: 'Standard',
    description: 'Within a few days',
    icon: <Clock size={20} color="#64748B" />,
  },
  {
    value: 'urgent',
    label: 'Urgent',
    description: 'Within 24 hours (+50%)',
    icon: <Zap size={20} color="#F59E0B" />,
  },
  {
    value: 'emergency',
    label: 'Emergency',
    description: 'ASAP - same day (+100%)',
    icon: <AlertTriangle size={20} color="#EF4444" />,
  },
];

export default function CustomerBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { calculateQuote, addCustomer, addJob, pricingPresets, settings, customers } = useTradeStore();

  const [step, setStep] = useState<Step>('issue');
  const [selectedJob, setSelectedJob] = useState<JobType | null>(null);
  const [urgency, setUrgency] = useState<Urgency>('standard');
  const [description, setDescription] = useState('');

  // Customer details
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [postcode, setPostcode] = useState('');

  const quote = selectedJob ? calculateQuote(selectedJob, urgency) : null;

  const handleSelectJob = (type: JobType) => {
    setSelectedJob(type);
  };

  const handleContinueToDetails = () => {
    if (selectedJob) {
      setStep('details');
    }
  };

  const handleContinueToConfirm = () => {
    if (name && phone && address && postcode) {
      setStep('confirm');
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedJob || !quote) return;

    // Check if tradesperson can accept new customers (Pro check)
    const totalCustomers = customers.length;
    let isPro = false;

    if (isRevenueCatEnabled()) {
      const result = await hasEntitlement('pro');
      isPro = result.ok ? result.data : false;
    }

    // If not Pro and at customer limit, show limit reached screen
    if (!isPro && totalCustomers >= FREE_TIER_LIMITS.maxCustomers) {
      setStep('limit_reached');
      return;
    }

    // Create customer
    const customerId = addCustomer({
      name,
      email,
      phone,
      address,
      postcode,
    });

    // Create job with quote
    addJob({
      customerId,
      type: selectedJob,
      description: description || jobOptions.find(j => j.type === selectedJob)?.description || '',
      urgency,
      status: 'QUOTED',
      quote: {
        ...quote,
        jobId: '', // Will be set by the store
      },
      notes: '',
    });

    // Send notification to tradesperson about new booking
    const jobLabel = jobOptions.find(j => j.type === selectedJob)?.label || selectedJob;
    await sendNewBookingNotification(name, jobLabel, urgency);

    setStep('success');
  };

  const renderStep = () => {
    switch (step) {
      case 'issue':
        return (
          <Animated.View entering={FadeInDown.duration(400)} className="flex-1">
            <Text className="text-white font-bold text-2xl mb-2">
              What do you need help with?
            </Text>
            <Text className="text-slate-400 mb-6">
              Select the issue that best describes your problem
            </Text>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              <View className="gap-3 pb-4">
                {jobOptions.map((option) => (
                  <Pressable
                    key={option.type}
                    onPress={() => handleSelectJob(option.type)}
                    className={`p-4 rounded-xl border flex-row items-center ${
                      selectedJob === option.type
                        ? 'bg-[#14B8A6]/20 border-[#14B8A6]'
                        : 'bg-[#1E293B] border-[#334155]'
                    }`}
                  >
                    <View className="w-12 h-12 rounded-xl bg-[#0F172A] items-center justify-center mr-3">
                      {option.icon}
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-semibold">{option.label}</Text>
                      <Text className="text-slate-400 text-sm mt-0.5">{option.description}</Text>
                    </View>
                    {selectedJob === option.type && (
                      <View className="w-6 h-6 rounded-full bg-[#14B8A6] items-center justify-center">
                        <Check size={14} color="#FFF" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>

              {/* Urgency Selection */}
              {selectedJob && (
                <Animated.View entering={FadeInDown.duration(300)} className="mt-4 mb-4">
                  <Text className="text-white font-semibold mb-3">How urgent is this?</Text>
                  <View className="gap-2">
                    {urgencyOptions.map((option) => (
                      <Pressable
                        key={option.value}
                        onPress={() => setUrgency(option.value)}
                        className={`p-3 rounded-xl border flex-row items-center ${
                          urgency === option.value
                            ? 'bg-[#14B8A6]/20 border-[#14B8A6]'
                            : 'bg-[#1E293B] border-[#334155]'
                        }`}
                      >
                        {option.icon}
                        <View className="ml-3 flex-1">
                          <Text className="text-white font-medium">{option.label}</Text>
                          <Text className="text-slate-500 text-xs">{option.description}</Text>
                        </View>
                        {urgency === option.value && (
                          <Check size={18} color={TURQUOISE} />
                        )}
                      </Pressable>
                    ))}
                  </View>
                </Animated.View>
              )}

              {/* Additional Description */}
              {selectedJob && (
                <Animated.View entering={FadeInDown.delay(100).duration(300)} className="mb-4">
                  <Text className="text-white font-semibold mb-2">Additional details (optional)</Text>
                  <TextInput
                    className="bg-[#1E293B] rounded-xl p-4 text-white border border-[#334155] min-h-[100px]"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe your issue in more detail..."
                    placeholderTextColor="#64748B"
                    multiline
                    textAlignVertical="top"
                  />
                </Animated.View>
              )}
            </ScrollView>

            {/* Quote Preview & Continue */}
            {selectedJob && quote && (
              <Animated.View entering={FadeInDown.duration(300)} className="pt-4 border-t border-[#334155]">
                <View className="bg-[#1E293B] rounded-xl p-4 mb-4">
                  <Text className="text-slate-400 text-sm">Estimated Quote</Text>
                  <Text className="text-[#14B8A6] font-bold text-3xl mt-1">
                    £{quote.total.toFixed(2)}
                  </Text>
                  <Text className="text-slate-500 text-xs mt-1">
                    Inc. VAT • Valid for 48 hours
                  </Text>
                </View>
                <Pressable
                  onPress={handleContinueToDetails}
                  className="bg-[#14B8A6] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
                >
                  <Text className="text-white font-bold">Continue</Text>
                  <ChevronRight size={20} color="#FFF" />
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        );

      case 'details':
        return (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            className="flex-1"
          >
            <Animated.View entering={FadeInDown.duration(400)} className="flex-1">
              <Text className="text-white font-bold text-2xl mb-2">
                Your Details
              </Text>
              <Text className="text-slate-400 mb-6">
                We need a few details to arrange your appointment
              </Text>

              <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="gap-4 pb-4">
                  <View>
                    <Text className="text-slate-400 text-sm mb-2">Full Name</Text>
                    <View className="flex-row items-center bg-[#1E293B] rounded-xl border border-[#334155]">
                      <View className="pl-4">
                        <User size={18} color="#64748B" />
                      </View>
                      <TextInput
                        className="flex-1 p-4 text-white"
                        value={name}
                        onChangeText={setName}
                        placeholder="John Smith"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-slate-400 text-sm mb-2">Phone Number</Text>
                    <View className="flex-row items-center bg-[#1E293B] rounded-xl border border-[#334155]">
                      <View className="pl-4">
                        <Phone size={18} color="#64748B" />
                      </View>
                      <TextInput
                        className="flex-1 p-4 text-white"
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="07700 000000"
                        placeholderTextColor="#64748B"
                        keyboardType="phone-pad"
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-slate-400 text-sm mb-2">Email (optional)</Text>
                    <View className="flex-row items-center bg-[#1E293B] rounded-xl border border-[#334155]">
                      <View className="pl-4">
                        <Mail size={18} color="#64748B" />
                      </View>
                      <TextInput
                        className="flex-1 p-4 text-white"
                        value={email}
                        onChangeText={setEmail}
                        placeholder="you@example.com"
                        placeholderTextColor="#64748B"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-slate-400 text-sm mb-2">Address</Text>
                    <View className="flex-row items-center bg-[#1E293B] rounded-xl border border-[#334155]">
                      <View className="pl-4">
                        <MapPin size={18} color="#64748B" />
                      </View>
                      <TextInput
                        className="flex-1 p-4 text-white"
                        value={address}
                        onChangeText={setAddress}
                        placeholder="123 Main Street"
                        placeholderTextColor="#64748B"
                      />
                    </View>
                  </View>

                  <View>
                    <Text className="text-slate-400 text-sm mb-2">Postcode</Text>
                    <TextInput
                      className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 text-white"
                      value={postcode}
                      onChangeText={(v) => setPostcode(v.toUpperCase())}
                      placeholder="SW1A 1AA"
                      placeholderTextColor="#64748B"
                      autoCapitalize="characters"
                    />
                  </View>
                </View>
              </ScrollView>

              <View className="pt-4 border-t border-[#334155]">
                <Pressable
                  onPress={handleContinueToConfirm}
                  disabled={!name || !phone || !address || !postcode}
                  className={`rounded-xl p-4 flex-row items-center justify-center ${
                    name && phone && address && postcode
                      ? 'bg-[#14B8A6] active:opacity-80'
                      : 'bg-[#334155]'
                  }`}
                >
                  <Text className={`font-bold ${
                    name && phone && address && postcode ? 'text-white' : 'text-slate-500'
                  }`}>
                    Review Booking
                  </Text>
                  <ChevronRight size={20} color={name && phone && address && postcode ? '#FFF' : '#64748B'} />
                </Pressable>
              </View>
            </Animated.View>
          </KeyboardAvoidingView>
        );

      case 'confirm':
        const selectedJobOption = jobOptions.find(j => j.type === selectedJob);
        return (
          <Animated.View entering={FadeInDown.duration(400)} className="flex-1">
            <Text className="text-white font-bold text-2xl mb-2">
              Confirm Your Booking
            </Text>
            <Text className="text-slate-400 mb-6">
              Please review the details below
            </Text>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
              {/* Job Summary */}
              <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
                <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Service</Text>
                <Text className="text-white font-bold text-lg">{selectedJobOption?.label}</Text>
                <Text className="text-slate-400 text-sm mt-1">
                  {description || selectedJobOption?.description}
                </Text>
                {urgency !== 'standard' && (
                  <View className="flex-row items-center mt-2">
                    {urgency === 'urgent' ? (
                      <Zap size={14} color="#F59E0B" />
                    ) : (
                      <AlertTriangle size={14} color="#EF4444" />
                    )}
                    <Text className={`ml-1 text-sm font-medium ${
                      urgency === 'urgent' ? 'text-[#F59E0B]' : 'text-[#EF4444]'
                    }`}>
                      {urgency === 'urgent' ? 'Urgent' : 'Emergency'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Customer Summary */}
              <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
                <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Your Details</Text>
                <Text className="text-white font-semibold">{name}</Text>
                <Text className="text-slate-400 text-sm">{phone}</Text>
                {email && <Text className="text-slate-400 text-sm">{email}</Text>}
                <Text className="text-slate-400 text-sm mt-2">{address}</Text>
                <Text className="text-slate-400 text-sm">{postcode}</Text>
              </View>

              {/* Quote Breakdown */}
              {quote && (
                <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
                  <Text className="text-slate-400 text-xs uppercase tracking-wide mb-3">Quote</Text>
                  <View className="bg-[#0F172A] rounded-lg p-3">
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500">Labour</Text>
                      <Text className="text-slate-300">£{quote.labour.toFixed(2)}</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500">Materials (est.)</Text>
                      <Text className="text-slate-300">£{quote.materials.toFixed(2)}</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500">Travel</Text>
                      <Text className="text-slate-300">£{quote.travel.toFixed(2)}</Text>
                    </View>
                    {quote.emergencySurcharge > 0 && (
                      <View className="flex-row justify-between mb-2">
                        <Text className="text-slate-500">Emergency Surcharge</Text>
                        <Text className="text-slate-300">£{quote.emergencySurcharge.toFixed(2)}</Text>
                      </View>
                    )}
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500">VAT (20%)</Text>
                      <Text className="text-slate-300">£{quote.vat.toFixed(2)}</Text>
                    </View>
                    <View className="border-t border-[#334155] mt-2 pt-2 flex-row justify-between">
                      <Text className="text-white font-bold">Total</Text>
                      <Text className="text-[#14B8A6] font-bold text-xl">£{quote.total.toFixed(2)}</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Guarantee */}
              <View className="flex-row items-center bg-[#14B8A6]/10 rounded-xl p-4 mb-4">
                <Shield size={24} color={TURQUOISE} />
                <View className="ml-3">
                  <Text className="text-white font-semibold">12-Month Guarantee</Text>
                  <Text className="text-slate-400 text-sm">All work comes with a workmanship guarantee</Text>
                </View>
              </View>
            </ScrollView>

            <View className="pt-4 border-t border-[#334155]">
              <Pressable
                onPress={handleConfirmBooking}
                className="bg-[#14B8A6] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
              >
                <Check size={20} color="#FFF" />
                <Text className="text-white font-bold ml-2">Confirm Booking</Text>
              </Pressable>
              <Text className="text-slate-500 text-xs text-center mt-3">
                Quote valid for 48 hours. Final price may vary based on actual work required.
              </Text>
            </View>
          </Animated.View>
        );

      case 'success':
        return (
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="flex-1 items-center justify-center"
          >
            <View className="w-24 h-24 rounded-full bg-[#14B8A6]/20 items-center justify-center mb-6">
              <Check size={48} color={TURQUOISE} />
            </View>
            <Text className="text-white font-bold text-2xl mb-2">Booking Received!</Text>
            <Text className="text-slate-400 text-center px-8 mb-8">
              We've received your booking request. The plumber will review and confirm your appointment shortly.
            </Text>
            <View className="bg-[#1E293B] rounded-xl p-4 w-full max-w-[300px]">
              <Text className="text-slate-400 text-sm text-center">
                You'll receive a confirmation via{'\n'}
                <Text className="text-white font-medium">SMS to {phone}</Text>
              </Text>
            </View>
          </Animated.View>
        );

      case 'limit_reached':
        return (
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="flex-1 items-center justify-center"
          >
            <View className="w-24 h-24 rounded-full bg-[#EF4444]/20 items-center justify-center mb-6">
              <XCircle size={48} color="#EF4444" />
            </View>
            <Text className="text-white font-bold text-2xl mb-2">Unavailable</Text>
            <Text className="text-slate-400 text-center px-8 mb-8">
              Sorry, this tradesperson is not currently accepting new customers. Please try again later or contact them directly.
            </Text>
            <View className="bg-[#1E293B] rounded-xl p-4 w-full max-w-[300px]">
              <Text className="text-slate-400 text-sm text-center">
                The tradesperson has reached their{'\n'}
                <Text className="text-white font-medium">customer capacity</Text>
              </Text>
            </View>
          </Animated.View>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#0F172A]">
      <View className="flex-1 px-4 pt-4">
        {/* Header */}
        <View className="items-center mb-6">
          <Text className="text-[#14B8A6] font-bold text-2xl">TRADIE</Text>
          <Text className="text-slate-500 text-sm">Professional Services</Text>
        </View>

        {/* Progress Indicator */}
        {step !== 'success' && step !== 'limit_reached' && (
          <View className="flex-row items-center justify-center mb-6">
            {['issue', 'details', 'confirm'].map((s, index) => (
              <React.Fragment key={s}>
                <View
                  className={`w-8 h-8 rounded-full items-center justify-center ${
                    step === s
                      ? 'bg-[#14B8A6]'
                      : ['issue', 'details', 'confirm'].indexOf(step) > index
                      ? 'bg-[#14B8A6]'
                      : 'bg-[#334155]'
                  }`}
                >
                  {['issue', 'details', 'confirm'].indexOf(step) > index ? (
                    <Check size={16} color="#FFF" />
                  ) : (
                    <Text className="text-white font-bold text-sm">{index + 1}</Text>
                  )}
                </View>
                {index < 2 && (
                  <View
                    className={`w-12 h-1 ${
                      ['issue', 'details', 'confirm'].indexOf(step) > index
                        ? 'bg-[#14B8A6]'
                        : 'bg-[#334155]'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </View>
        )}

        {renderStep()}
      </View>
    </SafeAreaView>
  );
}
