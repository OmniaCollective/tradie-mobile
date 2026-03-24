import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  X,
  Check,
  User,
  Phone,
  MapPin,
  Wrench,
  Clock,
  Zap,
  AlertTriangle,
  Calendar,
  Mic,
  Square,
  Loader,
  ChevronDown,
  Keyboard,
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import DateTimePicker from '@react-native-community/datetimepicker';
import { Audio } from 'expo-av';
import { useTradeStore, useCustomers, usePricingPresets, JobType, Urgency, Customer } from '@/lib/store';
import { getJobTypeLabel } from '@/lib/trades';
import { processVoiceNote, ExtractedJobData } from '@/lib/voiceJobExtractor';

const TURQUOISE = '#14B8A6';

type ScreenMode = 'voice' | 'form';
type RecordingState = 'idle' | 'recording' | 'processing';

const urgencyOptions: Array<{ value: Urgency; label: string; color: string }> = [
  { value: 'standard', label: 'Standard', color: '#64748B' },
  { value: 'urgent', label: 'Urgent', color: '#F59E0B' },
  { value: 'emergency', label: 'Emergency', color: '#EF4444' },
];

export default function AddJobScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const customers = useCustomers();
  const pricingPresets = usePricingPresets();
  const { addJob, addCustomer, calculateQuote, settings } = useTradeStore();

  const [mode, setMode] = useState<ScreenMode>('voice');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [transcription, setTranscription] = useState('');
  const recordingRef = useRef<Audio.Recording | null>(null);
  const trade = useTradeStore((s) => s.settings.trade);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPostcode, setCustomerPostcode] = useState('');
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [urgency, setUrgency] = useState<Urgency>('standard');
  const [description, setDescription] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date | null>(
    params.date ? new Date(params.date + 'T10:00:00') : null
  );
  const [scheduledTime, setScheduledTime] = useState<Date>(
    params.date ? new Date(params.date + 'T10:00:00') : (() => {
      const d = new Date();
      d.setHours(10, 0, 0, 0);
      return d;
    })()
  );
  const [hasDate, setHasDate] = useState(!!params.date);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showJobTypePicker, setShowJobTypePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);

  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  useEffect(() => {
    if (recordingState === 'recording') {
      pulseScale.value = withRepeat(
        withTiming(1.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1, true
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1, true
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = 1;
      pulseOpacity.value = 0.3;
    }
  }, [recordingState, pulseScale, pulseOpacity]);

  useEffect(() => {
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const quote = useMemo(() => {
    if (!selectedJobType) return null;
    return calculateQuote(selectedJobType, urgency);
  }, [selectedJobType, urgency, calculateQuote]);

  const jobTypeLabel = selectedJobType ? getJobTypeLabel(settings.trade, selectedJobType) : '';
  const canSave = customerName.trim() && customerPhone.trim() && selectedJobType;

  const startRecording = useCallback(async () => {
    try {
      setErrorMessage('');
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { setErrorMessage('Microphone permission is required'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setRecordingState('recording');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Failed to start recording:', error);
      setErrorMessage('Failed to start recording');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    setRecordingState('processing');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) throw new Error('No recording URI');
      const { transcription: text, extracted } = await processVoiceNote(uri, trade, pricingPresets);
      setTranscription(text);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fillFromExtracted(extracted);
      setMode('form');
      setRecordingState('idle');
    } catch (error) {
      console.error('Voice processing error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to process voice note');
      setRecordingState('idle');
    }
  }, [trade, pricingPresets]);

  const handleMicPress = useCallback(() => {
    if (recordingState === 'idle') startRecording();
    else if (recordingState === 'recording') stopRecording();
  }, [recordingState, startRecording, stopRecording]);

  const fillFromExtracted = useCallback((data: ExtractedJobData) => {
    if (data.customerName) {
      const match = customers.find((c) => c.name.toLowerCase() === data.customerName!.toLowerCase());
      if (match) {
        setMatchedCustomer(match);
        setCustomerName(match.name);
        setCustomerPhone(match.phone);
        setCustomerAddress(match.address);
        setCustomerPostcode(match.postcode);
      } else {
        setCustomerName(data.customerName);
      }
    }
    if (data.phone) setCustomerPhone(data.phone);
    if (data.address) setCustomerAddress(data.address);
    if (data.postcode) setCustomerPostcode(data.postcode.toUpperCase());
    if (data.jobType) {
      const preset = pricingPresets.find((p) => p.label.toLowerCase() === data.jobType!.toLowerCase());
      if (preset) setSelectedJobType(preset.type);
    }
    if (data.scheduledDate) {
      const d = new Date(data.scheduledDate);
      if (!isNaN(d.getTime())) { setScheduledDate(d); setHasDate(true); }
    }
    if (data.scheduledTime) {
      const [h, m] = data.scheduledTime.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) { const t = new Date(); t.setHours(h, m, 0, 0); setScheduledTime(t); }
    }
    if (data.description) setDescription(data.description);
    if (data.urgency && ['standard', 'urgent', 'emergency'].includes(data.urgency)) {
      setUrgency(data.urgency as Urgency);
    }
  }, [customers, pricingPresets]);

  const handleSave = useCallback(async () => {
    if (!selectedJobType || !customerName.trim() || !customerPhone.trim()) return;
    setSaving(true);
    try {
      let customerId: string;
      if (matchedCustomer) {
        customerId = matchedCustomer.id;
      } else {
        customerId = addCustomer({
          name: customerName.trim(), phone: customerPhone.trim(), email: '',
          address: customerAddress.trim(), postcode: customerPostcode.trim().toUpperCase(),
        });
      }
      const dateStr = hasDate && scheduledDate ? scheduledDate.toISOString().split('T')[0] : undefined;
      const timeStr = hasDate && scheduledTime
        ? `${scheduledTime.getHours().toString().padStart(2, '0')}:${scheduledTime.getMinutes().toString().padStart(2, '0')}`
        : undefined;

      addJob({
        customerId, type: selectedJobType,
        description: description.trim() || jobTypeLabel, urgency,
        status: hasDate ? 'SCHEDULED' : 'QUOTED',
        scheduledDate: dateStr, scheduledTime: timeStr,
        quote: quote ? { ...quote, jobId: '' } : undefined, notes: '',
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('Save error:', error);
      setSaving(false);
    }
  }, [
    selectedJobType, customerName, customerPhone, customerAddress, customerPostcode,
    matchedCustomer, addCustomer, addJob, hasDate, scheduledDate, scheduledTime,
    description, urgency, quote, router,
  ]);

  const formatDateStr = (date: Date) =>
    date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const formatTimeStr = (date: Date) => {
    const h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  // ── Voice Landing ────────────────────────────────────────────────

  if (mode === 'voice') {
    return (
      <View className="flex-1 bg-[#0F172A]">
        <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
          <Pressable
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-[#1E293B] items-center justify-center"
          >
            <X size={20} color="#F8FAFC" />
          </Pressable>
          <Text className="text-white font-bold text-lg">New Job</Text>
          <View className="w-10" />
        </View>

        <View className="flex-1 items-center justify-center px-8">
          {recordingState === 'processing' ? (
            <Animated.View entering={FadeIn.duration(300)} className="items-center">
              <View
                style={{
                  width: 100, height: 100, borderRadius: 50,
                  backgroundColor: TURQUOISE, alignItems: 'center',
                  justifyContent: 'center', opacity: 0.6,
                }}
              >
                <Loader size={40} color="#FFF" />
              </View>
              <Text className="text-white font-bold text-xl mt-6">Processing...</Text>
              <Text className="text-slate-400 text-center mt-2">
                Extracting job details from your voice note
              </Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(400)} className="items-center">
              <View className="items-center justify-center" style={{ width: 160, height: 160 }}>
                {recordingState === 'recording' && (
                  <Animated.View
                    style={[{
                      position: 'absolute', width: 160, height: 160,
                      borderRadius: 80, backgroundColor: '#EF4444',
                    }, pulseStyle]}
                  />
                )}
                <Pressable
                  onPress={handleMicPress}
                  style={{
                    width: 120, height: 120, borderRadius: 60,
                    backgroundColor: recordingState === 'recording' ? '#EF4444' : TURQUOISE,
                    alignItems: 'center', justifyContent: 'center',
                    shadowColor: recordingState === 'recording' ? '#EF4444' : TURQUOISE,
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5, shadowRadius: 16, elevation: 10,
                  }}
                >
                  {recordingState === 'recording'
                    ? <Square size={40} color="#FFF" fill="#FFF" />
                    : <Mic size={48} color="#FFF" />}
                </Pressable>
              </View>

              <Text className="text-white font-bold text-xl mt-8">
                {recordingState === 'recording' ? 'Recording...' : 'Tap to Record'}
              </Text>
              <Text className="text-slate-400 text-center mt-2 px-4">
                {recordingState === 'recording'
                  ? "Tap the stop button when you're done"
                  : '"Dave Smith, leaking tap, 14 Oak Lane SW1A 1AA, Thursday 2pm"'}
              </Text>

              {errorMessage ? (
                <View className="bg-[#EF4444]/20 rounded-xl p-3 mt-4 w-full">
                  <Text className="text-[#EF4444] text-sm text-center">{errorMessage}</Text>
                </View>
              ) : null}
            </Animated.View>
          )}
        </View>

        {recordingState === 'idle' && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="pb-10 items-center">
            <Pressable onPress={() => setMode('form')} className="flex-row items-center py-3 px-6">
              <Keyboard size={18} color="#64748B" />
              <Text className="text-slate-500 text-base ml-2">Type instead</Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
    );
  }

  // ── Editable Summary / Form ──────────────────────────────────────

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-[#0F172A]"
    >
      <View className="flex-row items-center justify-between px-4 pt-4 pb-2">
        <Pressable
          onPress={() => {
            if (transcription) { setMode('voice'); setRecordingState('idle'); setTranscription(''); }
            else router.back();
          }}
          className="w-10 h-10 rounded-full bg-[#1E293B] items-center justify-center"
        >
          <X size={20} color="#F8FAFC" />
        </Pressable>
        <Text className="text-white font-bold text-lg">
          {transcription ? 'Review Job' : 'New Job'}
        </Text>
        <Pressable
          onPress={() => { setMode('voice'); setRecordingState('idle'); }}
          className="w-10 h-10 rounded-full bg-[#14B8A6]/20 items-center justify-center"
        >
          <Mic size={20} color={TURQUOISE} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-4" keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.duration(400)}>
          {transcription ? (
            <View className="bg-[#14B8A6]/10 border border-[#14B8A6]/30 rounded-xl p-3 mb-4">
              <Text className="text-slate-400 text-xs uppercase tracking-wide mb-1">Voice Note</Text>
              <Text className="text-slate-300 text-sm">{transcription}</Text>
            </View>
          ) : null}

          <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2 mt-2">Customer</Text>
          <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <User size={16} color="#64748B" />
              <TextInput
                className="flex-1 text-white text-base ml-3"
                placeholder="Customer name"
                placeholderTextColor="#475569"
                value={customerName}
                onChangeText={(text) => {
                  setCustomerName(text);
                  const match = customers.find((c) => c.name.toLowerCase() === text.toLowerCase());
                  if (match) {
                    setMatchedCustomer(match);
                    setCustomerPhone(match.phone);
                    setCustomerAddress(match.address);
                    setCustomerPostcode(match.postcode);
                  } else {
                    setMatchedCustomer(null);
                  }
                }}
                autoCapitalize="words"
              />
            </View>
            <View className="flex-row items-center mb-3">
              <Phone size={16} color="#64748B" />
              <TextInput
                className="flex-1 text-white text-base ml-3"
                placeholder="Phone number"
                placeholderTextColor="#475569"
                value={customerPhone}
                onChangeText={setCustomerPhone}
                keyboardType="phone-pad"
              />
            </View>
            <View className="flex-row items-center mb-3">
              <MapPin size={16} color="#64748B" />
              <TextInput
                className="flex-1 text-white text-base ml-3"
                placeholder="Address"
                placeholderTextColor="#475569"
                value={customerAddress}
                onChangeText={setCustomerAddress}
              />
            </View>
            <TextInput
              className="text-white text-base ml-7"
              placeholder="Postcode"
              placeholderTextColor="#475569"
              value={customerPostcode}
              onChangeText={(v) => setCustomerPostcode(v.toUpperCase())}
              autoCapitalize="characters"
            />
            {matchedCustomer && (
              <View className="flex-row items-center mt-2 ml-7">
                <Check size={14} color={TURQUOISE} />
                <Text className="text-[#14B8A6] text-xs ml-1">Existing customer matched</Text>
              </View>
            )}
          </View>

          <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Job</Text>
          <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
            <Pressable onPress={() => setShowJobTypePicker(!showJobTypePicker)} className="flex-row items-center">
              <Wrench size={16} color={selectedJobType ? TURQUOISE : '#64748B'} />
              <Text className={`flex-1 text-base ml-3 ${selectedJobType ? 'text-white font-semibold' : 'text-slate-500'}`}>
                {selectedJobType ? jobTypeLabel : 'Select job type'}
              </Text>
              <ChevronDown size={18} color="#64748B" />
            </Pressable>

            {showJobTypePicker && (
              <Animated.View entering={FadeInDown.duration(200)} className="mt-3 border-t border-[#334155] pt-3">
                {pricingPresets.map((preset) => {
                  const isSelected = selectedJobType === preset.type;
                  return (
                    <Pressable
                      key={preset.type}
                      onPress={() => {
                        setSelectedJobType(preset.type);
                        setShowJobTypePicker(false);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      className={`flex-row items-center rounded-lg p-3 mb-1 ${isSelected ? 'bg-[#14B8A6]/15' : ''}`}
                    >
                      <Text className="text-white flex-1">{preset.label}</Text>
                      <Text className="text-slate-500 text-sm mr-2">{'\u00A3'}{preset.basePrice}</Text>
                      {isSelected && <Check size={16} color={TURQUOISE} />}
                    </Pressable>
                  );
                })}
              </Animated.View>
            )}

            {selectedJobType && (
              <View className="mt-3 border-t border-[#334155] pt-3">
                <TextInput
                  className="text-white text-sm"
                  placeholder="Job description (optional)"
                  placeholderTextColor="#475569"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                />
              </View>
            )}

            {selectedJobType && (
              <View className="mt-3 border-t border-[#334155] pt-3">
                <View className="flex-row gap-2">
                  {urgencyOptions.map((opt) => {
                    const isSelected = urgency === opt.value;
                    return (
                      <Pressable
                        key={opt.value}
                        onPress={() => { setUrgency(opt.value); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                        className={`flex-1 rounded-lg p-2 items-center border ${isSelected ? 'border-[#14B8A6] bg-[#14B8A6]/10' : 'border-[#334155]'}`}
                      >
                        {opt.value === 'standard' && <Clock size={14} color={isSelected ? TURQUOISE : opt.color} />}
                        {opt.value === 'urgent' && <Zap size={14} color={isSelected ? TURQUOISE : opt.color} />}
                        {opt.value === 'emergency' && <AlertTriangle size={14} color={isSelected ? TURQUOISE : opt.color} />}
                        <Text className={`text-xs mt-1 ${isSelected ? 'text-[#14B8A6] font-medium' : 'text-slate-500'}`}>
                          {opt.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </View>

          <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Schedule</Text>
          <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
            <View className="flex-row gap-2 mb-3">
              <Pressable
                onPress={() => {
                  setHasDate(true);
                  if (!scheduledDate) setScheduledDate(new Date());
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                className={`flex-1 rounded-lg p-3 items-center border ${hasDate ? 'border-[#14B8A6] bg-[#14B8A6]/10' : 'border-[#334155]'}`}
              >
                <Calendar size={16} color={hasDate ? TURQUOISE : '#64748B'} />
                <Text className={`text-xs mt-1 ${hasDate ? 'text-[#14B8A6] font-medium' : 'text-slate-500'}`}>Set Date</Text>
              </Pressable>
              <Pressable
                onPress={() => { setHasDate(false); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                className={`flex-1 rounded-lg p-3 items-center border ${!hasDate ? 'border-[#14B8A6] bg-[#14B8A6]/10' : 'border-[#334155]'}`}
              >
                <Clock size={16} color={!hasDate ? TURQUOISE : '#64748B'} />
                <Text className={`text-xs mt-1 ${!hasDate ? 'text-[#14B8A6] font-medium' : 'text-slate-500'}`}>Not Yet</Text>
              </Pressable>
            </View>

            {hasDate && scheduledDate && (
              <>
                <Pressable
                  onPress={() => setShowDatePicker(!showDatePicker)}
                  className="flex-row items-center rounded-lg bg-[#0F172A] p-3 mb-2"
                >
                  <Calendar size={16} color={TURQUOISE} />
                  <Text className="text-white text-sm ml-2 flex-1">{formatDateStr(scheduledDate)}</Text>
                </Pressable>

                {showDatePicker && (
                  <View className="bg-[#0F172A] rounded-lg mb-2 overflow-hidden">
                    <DateTimePicker
                      value={scheduledDate}
                      mode="date"
                      display="inline"
                      minimumDate={new Date()}
                      onChange={(_, date) => {
                        if (date) setScheduledDate(date);
                        if (Platform.OS === 'android') setShowDatePicker(false);
                      }}
                      themeVariant="dark"
                      accentColor={TURQUOISE}
                    />
                    {Platform.OS === 'ios' && (
                      <Pressable onPress={() => setShowDatePicker(false)} className="p-3 items-center border-t border-[#334155]">
                        <Text className="text-[#14B8A6] font-semibold">Done</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                <Pressable
                  onPress={() => setShowTimePicker(!showTimePicker)}
                  className="flex-row items-center rounded-lg bg-[#0F172A] p-3"
                >
                  <Clock size={16} color={TURQUOISE} />
                  <Text className="text-white text-sm ml-2 flex-1">{formatTimeStr(scheduledTime)}</Text>
                </Pressable>

                {showTimePicker && (
                  <View className="bg-[#0F172A] rounded-lg mt-2 overflow-hidden">
                    <DateTimePicker
                      value={scheduledTime}
                      mode="time"
                      display="spinner"
                      minuteInterval={15}
                      onChange={(_, time) => {
                        if (time) setScheduledTime(time);
                        if (Platform.OS === 'android') setShowTimePicker(false);
                      }}
                      themeVariant="dark"
                      accentColor={TURQUOISE}
                    />
                    {Platform.OS === 'ios' && (
                      <Pressable onPress={() => setShowTimePicker(false)} className="p-3 items-center border-t border-[#334155]">
                        <Text className="text-[#14B8A6] font-semibold">Done</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </>
            )}
          </View>

          {quote && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text className="text-slate-400 text-xs uppercase tracking-wide mb-2">Quote</Text>
              <View className="bg-[#1E293B] rounded-xl border border-[#334155] p-4 mb-4">
                <View className="flex-row justify-between mb-1">
                  <Text className="text-slate-500 text-sm">Labour</Text>
                  <Text className="text-slate-300 text-sm">{'\u00A3'}{quote.labour.toFixed(2)}</Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-slate-500 text-sm">Materials (est.)</Text>
                  <Text className="text-slate-300 text-sm">{'\u00A3'}{quote.materials.toFixed(2)}</Text>
                </View>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-slate-500 text-sm">Travel</Text>
                  <Text className="text-slate-300 text-sm">{'\u00A3'}{quote.travel.toFixed(2)}</Text>
                </View>
                {quote.emergencySurcharge > 0 && (
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-slate-500 text-sm">Emergency</Text>
                    <Text className="text-slate-300 text-sm">{'\u00A3'}{quote.emergencySurcharge.toFixed(2)}</Text>
                  </View>
                )}
                {quote.vat > 0 && (
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-slate-500 text-sm">VAT</Text>
                    <Text className="text-slate-300 text-sm">{'\u00A3'}{quote.vat.toFixed(2)}</Text>
                  </View>
                )}
                <View className="border-t border-[#334155] mt-2 pt-2 flex-row justify-between">
                  <Text className="text-white font-bold">Total</Text>
                  <Text className="text-[#14B8A6] font-bold text-xl">{'\u00A3'}{quote.total.toFixed(2)}</Text>
                </View>
              </View>
            </Animated.View>
          )}

          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            className={`rounded-xl p-4 flex-row items-center justify-center mb-8 ${
              canSave && !saving ? 'bg-[#14B8A6] active:opacity-80' : 'bg-[#334155]'
            }`}
          >
            {saving
              ? <Loader size={20} color={canSave ? '#FFF' : '#64748B'} />
              : <Check size={20} color={canSave ? '#FFF' : '#64748B'} />}
            <Text className={`font-bold text-base ml-2 ${canSave && !saving ? 'text-white' : 'text-slate-500'}`}>
              {saving ? 'Saving...' : 'Save Job'}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
