import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Platform, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, User, Phone, Mail, MapPin, Mic, Square, Keyboard, Wrench, Calendar, Clock, type LucideIcon } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing, cancelAnimation } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { formatDateObj, formatTimeObj, parseDate } from '@/lib/dates';
import { formatMoney } from '@/lib/money';
import { useTradeStore, useCustomers, usePricingPresets, type JobType, type Urgency, type Customer } from '@/lib/store';
import { getJobTypeLabel } from '@/lib/store';
import { processVoiceNote, useVoiceAllowance, type ExtractedJobData } from '@/lib/voice';
import { ApiError } from '@/lib/api';
import { useAccount } from '@/lib/auth';
import { scheduleJob } from '@/lib/booking';
import { useProAccess } from '@/lib/useProAccess';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { Group, RowDivider, SectionHeader, Segmented, LinkRow, Sheet } from '@/components/ui';
import { AppleSignInButton } from '@/components/AppleSignInButton';
import { UpgradePrompt } from '@/components/UpgradePrompt';

type Mode = 'voice' | 'form';
type RecordingState = 'idle' | 'recording' | 'processing';

function InputRow({
  icon: Icon,
  ...props
}: { icon: LucideIcon } & React.ComponentProps<typeof TextInput>) {
  const t = useTheme();
  return (
    <View className="flex-row items-center px-4 min-h-[52px]">
      <Icon size={20} color={t.secondary} strokeWidth={2} />
      <TextInput className="flex-1 text-fg text-base ml-3 py-3" placeholderTextColor={t.secondary} {...props} />
    </View>
  );
}

export default function AddJobScreen() {
  const router = useRouter();
  // Opened from a link or notification there may be nothing to go back to; then go Home.
  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const params = useLocalSearchParams<{ date?: string }>();
  const customers = useCustomers();
  const pricingPresets = usePricingPresets();
  const settings = useTradeStore((s) => s.settings);
  const addJob = useTradeStore((s) => s.addJob);
  const addCustomer = useTradeStore((s) => s.addCustomer);
  const calculateQuote = useTradeStore((s) => s.calculateQuote);
  const account = useAccount();
  const { isPro } = useProAccess();
  const freeVoiceLeft = useVoiceAllowance((s) => s.freeLeft);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [mode, setMode] = useState<Mode>(params.date ? 'form' : 'voice');
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [transcription, setTranscription] = useState('');
  const [voiceLimit, setVoiceLimit] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPostcode, setCustomerPostcode] = useState('');
  const [matchedCustomer, setMatchedCustomer] = useState<Customer | null>(null);
  const [jobType, setJobType] = useState<JobType | null>(null);
  const [urgency, setUrgency] = useState<Urgency>('standard');
  const [description, setDescription] = useState('');
  const [hasDate, setHasDate] = useState(!!params.date);
  const [when, setWhen] = useState<Date>(() => {
    const d = params.date ? parseDate(params.date) : new Date();
    if (!params.date) d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [showJobTypes, setShowJobTypes] = useState(false);
  const [saving, setSaving] = useState(false);

  // Listening pulse
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 2 - pulse.value }));
  useEffect(() => {
    if (recordingState === 'recording') {
      pulse.set(withRepeat(withTiming(1.6, { duration: 1100, easing: Easing.out(Easing.ease) }), -1, false));
    } else {
      cancelAnimation(pulse);
      pulse.set(1);
    }
  }, [recordingState, pulse]);

  // Stop a recording left running when the screen closes. Expo may already have released the
  // native recorder by then, and touching a released recorder throws, so every access is guarded.
  useEffect(
    () => () => {
      try {
        if (recorder.isRecording) recorder.stop().catch(() => {});
      } catch {
        // already released: nothing to stop
      }
    },
    [recorder],
  );

  const quote = useMemo(() => (jobType ? calculateQuote(jobType, urgency) : null), [jobType, urgency, calculateQuote]);
  const jobLabel = jobType ? getJobTypeLabel(settings.trade, jobType) : '';
  const canSave = !!customerName.trim() && !!customerPhone.trim() && !!jobType && !saving;

  const applyCustomer = (c: Customer | null) => {
    setMatchedCustomer(c);
    if (!c) return;
    setCustomerName(c.name);
    setCustomerEmail(c.email);
    setCustomerPhone(c.phone);
    setCustomerAddress(c.address);
    setCustomerPostcode(c.postcode);
  };

  const fillFromVoice = useCallback(
    (data: ExtractedJobData) => {
      if (data.customerName) {
        const match = customers.find((c) => c.name.toLowerCase() === data.customerName!.toLowerCase());
        if (match) applyCustomer(match);
        else setCustomerName(data.customerName);
      }
      if (data.phone) setCustomerPhone(data.phone);
      if (data.address) setCustomerAddress(data.address);
      if (data.postcode) setCustomerPostcode(data.postcode.toUpperCase());
      if (data.jobType) {
        const preset = pricingPresets.find((p) => p.label.toLowerCase() === data.jobType!.toLowerCase());
        if (preset) setJobType(preset.type);
      }
      if (data.description) setDescription(data.description);
      if (data.urgency === 'standard' || data.urgency === 'urgent' || data.urgency === 'emergency') setUrgency(data.urgency);
      if (data.scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(data.scheduledDate)) {
        const d = parseDate(data.scheduledDate);
        const [h, m] = (data.scheduledTime ?? '10:00').split(':').map(Number);
        d.setHours(Number.isFinite(h) ? h : 10, Number.isFinite(m) ? m : 0, 0, 0);
        setWhen(d);
        setHasDate(true);
      }
    },
     
    [customers, pricingPresets],
  );

  const startRecording = async () => {
    setErrorMessage('');
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setErrorMessage('Allow microphone access in the iPhone Settings app to add jobs by voice.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingState('recording');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      if (__DEV__) console.error('Failed to start recording:', error);
      setErrorMessage('Couldn’t start recording. Please try again.');
    }
  };

  const stopRecording = async () => {
    if (!recorder.isRecording) return;
    setRecordingState('processing');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!recorder.uri) throw new Error('No recording');
      const { transcription: text, extracted } = await processVoiceNote(
        recorder.uri,
        settings.trade,
        pricingPresets.map((p) => p.label),
      );
      setTranscription(text);
      fillFromVoice(extracted);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMode('form');
    } catch (error) {
      if (__DEV__) console.error('Voice processing error:', error);
      const code = error instanceof ApiError ? error.code : '';
      if (code === 'VOICE_LIMIT_REACHED') {
        useVoiceAllowance.getState().set(0);
        setVoiceLimit(true);
      } else if (code === 'NETWORK') {
        setErrorMessage('No internet connection. Try again, or type the job in.');
      } else if (code === 'EMPTY') {
        setErrorMessage('We didn’t catch anything. Try again a little closer to the phone.');
      } else if (code !== 'UNAUTHORIZED') {
        setErrorMessage('Couldn’t read that note. Try again, or type the job in.');
      }
    } finally {
      setRecordingState('idle');
    }
  };

  const handleSave = async () => {
    if (!canSave || !jobType) return;
    setSaving(true);
    try {
      const customerId =
        matchedCustomer?.id ??
        addCustomer({
          name: customerName.trim(),
          email: customerEmail.trim(),
          phone: customerPhone.trim(),
          address: customerAddress.trim(),
          postcode: customerPostcode.trim().toUpperCase(),
        });
      const jobId = addJob({
        customerId,
        type: jobType,
        description: description.trim() || jobLabel,
        urgency,
        // The quote is ready but not sent; sharing it from the job marks it Quoted.
        status: 'REQUESTED',
        quote: quote ? { ...quote, jobId: '' } : undefined,
        notes: '',
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const { jobs, customers: all } = useTradeStore.getState();
      const job = jobs.find((j) => j.id === jobId);
      const customer = all.find((c) => c.id === customerId);
      if (hasDate && job && customer) {
        await scheduleJob(job, customer, when);
        goBack();
      } else {
        // Not booked yet: open the job so times can be suggested straight away.
        router.replace(`/job/${jobId}`);
      }
    } catch (error) {
      if (__DEV__) console.error('Save error:', error);
      setSaving(false);
    }
  };

  const header = (title: string, right?: React.ReactNode) => (
    <View className="flex-row items-center justify-between px-4" style={{ paddingTop: Platform.OS === 'ios' ? 12 : insets.top + 8 }}>
      <Pressable
        onPress={() => (mode === 'form' && transcription ? setMode('voice') : goBack())}
        hitSlop={10}
        className="min-h-[44px] justify-center min-w-[56px]"
        accessibilityRole="button"
      >
        <Text className="text-link text-[17px]">{mode === 'form' && transcription ? 'Back' : 'Cancel'}</Text>
      </Pressable>
      <Text className="text-fg text-[17px] font-semibold">{title}</Text>
      <View className="min-w-[56px] items-end">{right}</View>
    </View>
  );

  // ── Voice ─────────────────────────────────────────────────────────────────

  if (mode === 'voice') {
    const signedIn = !!account;
    const recording = recordingState === 'recording';
    const processing = recordingState === 'processing';
    const iconOnAlert = t.mode === 'dark' ? t.onAccent : '#FFFFFF';

    return (
      <View className="flex-1 bg-bg">
        {header('New job')}
        <View className="flex-1 items-center justify-center px-8">
          <View className="items-center justify-center" style={{ width: 176, height: 176 }}>
            {recording && (
              <Animated.View
                style={[{ position: 'absolute', width: 112, height: 112, borderRadius: 56, backgroundColor: t.alert }, pulseStyle]}
              />
            )}
            <Pressable
              onPress={recording ? stopRecording : startRecording}
              disabled={processing || !signedIn}
              className={cn(
                'w-28 h-28 rounded-full items-center justify-center',
                recording ? 'bg-alert' : 'bg-accent',
                (!signedIn || processing) && 'opacity-40',
              )}
              accessibilityRole="button"
              accessibilityLabel={recording ? 'Stop recording' : 'Record the job'}
            >
              {processing ? (
                <ActivityIndicator color={t.onAccent} />
              ) : recording ? (
                <Square size={36} color={iconOnAlert} strokeWidth={2} />
              ) : (
                <Mic size={44} color={t.onAccent} strokeWidth={2} />
              )}
            </Pressable>
          </View>

          <Text className="text-fg text-[22px] font-bold mt-4 text-center">
            {processing ? 'Reading your note…' : recording ? 'Listening…' : 'Say the job'}
          </Text>
          <Text className="text-secondary text-[15px] text-center mt-2 leading-5">
            {processing
              ? 'Filling in the details for you'
              : recording
                ? 'Tap the button when you’ve finished'
                : '“Sarah Jones, leaking tap, 14 Oak Lane SE1, Thursday morning”'}
          </Text>
          {errorMessage ? <Text className="text-alert text-[15px] text-center mt-4">{errorMessage}</Text> : null}

          {!signedIn ? (
            <Group className="p-4 mt-8 w-full">
              <Text className="text-fg text-base font-semibold mb-1">Sign in to add jobs by voice</Text>
              <Text className="text-secondary text-[15px] leading-5 mb-4">
                It takes a second with your Apple ID. Your jobs stay on this phone.
              </Text>
              <AppleSignInButton />
            </Group>
          ) : !isPro && freeVoiceLeft !== null && !recording && !processing ? (
            <Text className="text-secondary text-[13px] text-center mt-6">
              {freeVoiceLeft} free voice {freeVoiceLeft === 1 ? 'job' : 'jobs'} left · unlimited with Pro
            </Text>
          ) : null}
        </View>

        {!recording && !processing && (
          <Pressable
            onPress={() => setMode('form')}
            className="flex-row items-center justify-center min-h-[52px] mb-2"
            style={{ marginBottom: insets.bottom + 8 }}
            accessibilityRole="button"
          >
            <Keyboard size={20} color={t.link} strokeWidth={2} />
            <Text className="text-link text-base font-semibold ml-2">Type it in instead</Text>
          </Pressable>
        )}

        <UpgradePrompt visible={voiceLimit} onClose={() => setVoiceLimit(false)} feature="voice" />
      </View>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────

  return (
    <View className="flex-1 bg-bg">
      {header(
        transcription ? 'Check the job' : 'New job',
        <Pressable onPress={handleSave} disabled={!canSave} hitSlop={10} className="min-h-[44px] justify-center" accessibilityRole="button">
          {saving ? (
            <ActivityIndicator color={t.link} />
          ) : (
            <Text className={cn('text-[17px] font-semibold', canSave ? 'text-link' : 'text-secondary opacity-50')}>Save</Text>
          )}
        </Pressable>,
      )}

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32 }}
      >
        {transcription ? (
          <Group className="p-4 mb-6">
            <Text className="text-secondary text-[13px] mb-1">You said</Text>
            <Text className="text-fg text-[15px] leading-6">{transcription}</Text>
          </Group>
        ) : null}

        <SectionHeader title="Customer" />
        <Group className="mb-2">
          <InputRow
            icon={User}
            placeholder="Name"
            value={customerName}
            onChangeText={(text) => {
              setCustomerName(text);
              const match = customers.find((c) => c.name.toLowerCase() === text.trim().toLowerCase());
              if (match) applyCustomer(match);
              else setMatchedCustomer(null);
            }}
            autoCapitalize="words"
            accessibilityLabel="Customer name"
          />
          <RowDivider />
          <InputRow icon={Phone} placeholder="Phone" value={customerPhone} onChangeText={setCustomerPhone} keyboardType="phone-pad" accessibilityLabel="Phone" />
          <RowDivider />
          <InputRow
            icon={Mail}
            placeholder="Email (optional)"
            value={customerEmail}
            onChangeText={setCustomerEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            accessibilityLabel="Email"
          />
          <RowDivider />
          <InputRow icon={MapPin} placeholder="Address" value={customerAddress} onChangeText={setCustomerAddress} accessibilityLabel="Address" />
          <RowDivider />
          <InputRow
            icon={MapPin}
            placeholder="Postcode"
            value={customerPostcode}
            onChangeText={(v) => setCustomerPostcode(v.toUpperCase())}
            autoCapitalize="characters"
            accessibilityLabel="Postcode"
          />
        </Group>
        <Text className={cn('text-[13px] mx-1 mb-8', matchedCustomer ? 'text-link' : 'text-secondary')}>
          {matchedCustomer ? 'Existing customer — details filled in.' : 'The postcode lets Tradie plan drive times.'}
        </Text>

        <SectionHeader title="Job" />
        <Group className="mb-8">
          <LinkRow icon={Wrench} label="Job type" value={jobType ? jobLabel : 'Choose'} onPress={() => setShowJobTypes(true)} />
          <RowDivider />
          <TextInput
            className="text-fg text-base px-4 py-3.5 min-h-[52px]"
            placeholder="What needs doing (optional)"
            placeholderTextColor={t.secondary}
            value={description}
            onChangeText={setDescription}
            multiline
            accessibilityLabel="Description"
          />
          <RowDivider />
          <View className="p-3">
            <Segmented
              className="bg-bg"
              options={[
                { key: 'standard', label: 'Standard' },
                { key: 'urgent', label: 'Urgent' },
                { key: 'emergency', label: 'Emergency' },
              ]}
              value={urgency}
              onChange={setUrgency}
            />
          </View>
        </Group>

        <SectionHeader title="When" />
        <Group className="mb-2">
          <View className="p-3">
            <Segmented
              className="bg-bg"
              options={[
                { key: 'later', label: 'Not booked yet' },
                { key: 'set', label: 'Set a time' },
              ]}
              value={hasDate ? 'set' : 'later'}
              onChange={(k) => setHasDate(k === 'set')}
            />
          </View>
          {hasDate && (
            <>
              <RowDivider />
              <LinkRow icon={Calendar} label="Date" value={formatDateObj(when)} onPress={() => setPicker(picker === 'date' ? null : 'date')} />
              {picker === 'date' && (
                <View className="items-center pb-2">
                  <DateTimePicker
                    value={when}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                    minimumDate={new Date()}
                    onChange={(_, d) => {
                      if (d) setWhen((cur) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), cur.getHours(), cur.getMinutes()));
                      if (Platform.OS === 'android') setPicker(null);
                    }}
                    themeVariant={t.mode}
                    accentColor={t.link}
                  />
                </View>
              )}
              <RowDivider />
              <LinkRow icon={Clock} label="Time" value={formatTimeObj(when)} onPress={() => setPicker(picker === 'time' ? null : 'time')} />
              {picker === 'time' && (
                <View className="items-center pb-2">
                  <DateTimePicker
                    value={when}
                    mode="time"
                    display="spinner"
                    minuteInterval={15}
                    onChange={(_, d) => {
                      if (d) setWhen((cur) => new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), d.getHours(), d.getMinutes()));
                      if (Platform.OS === 'android') setPicker(null);
                    }}
                    themeVariant={t.mode}
                    textColor={t.fg}
                  />
                </View>
              )}
            </>
          )}
        </Group>
        <Text className="text-secondary text-[13px] mx-1 mb-8">
          {hasDate ? 'You’ll get a reminder before the job.' : 'After saving, Tradie can suggest times that fit your diary.'}
        </Text>

        {quote && (
          <>
            <SectionHeader title="Quote" />
            <Group className="px-4 py-3">
              {(
                [
                  [urgency === 'standard' ? 'Labour' : `Labour (${urgency} rate)`, quote.labour],
                  ...(quote.vat > 0 ? [['VAT', quote.vat]] : []),
                ] as [string, number][]
              ).map(([k, v]) => (
                <View key={k} className="flex-row justify-between py-1">
                  <Text className="text-secondary text-[15px]">{k}</Text>
                  <Text className="text-fg text-[15px]">{formatMoney(v)}</Text>
                </View>
              ))}
              <View className="h-px bg-divider my-2" />
              <View className="flex-row justify-between py-1">
                <Text className="text-fg text-base font-semibold">Total</Text>
                <Text className="text-fg text-[17px] font-bold">{formatMoney(quote.total)}</Text>
              </View>
            </Group>
            <Text className="text-secondary text-[13px] mx-1 mt-2">
              Your price for this job type. After saving you can change it and add materials or travel.
            </Text>
          </>
        )}
      </ScrollView>

      <Sheet visible={showJobTypes} onClose={() => setShowJobTypes(false)}>
        <Text className="text-fg text-[17px] font-semibold text-center mb-3">Job type</Text>
        <ScrollView style={{ maxHeight: 440 }} className="bg-bg rounded-2xl">
          {pricingPresets.map((preset, i) => (
            <View key={preset.type}>
              {i > 0 && <RowDivider />}
              <Pressable
                onPress={() => {
                  setJobType(preset.type);
                  setShowJobTypes(false);
                  Haptics.selectionAsync();
                }}
                className="flex-row items-center px-4 min-h-[48px] active:opacity-70"
                accessibilityRole="button"
                accessibilityState={{ selected: jobType === preset.type }}
              >
                <Text className="flex-1 text-fg text-base">{preset.label}</Text>
                <Text className="text-secondary text-[15px] mr-3">from {formatMoney(preset.basePrice)}</Text>
                {jobType === preset.type && <Check size={20} color={t.link} strokeWidth={2} />}
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </Sheet>
    </View>
  );
}
