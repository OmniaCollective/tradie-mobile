import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Wrench,
  Zap,
  Leaf,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Dog,
  Droplets,
  Hammer,
  Car,
  Plus,
  User,
  Building,
  Phone,
  PoundSterling,
  ArrowRight,
  Check,
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  SlideInRight,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTradeStore } from '@/lib/store';
import { Trade, tradeConfigs } from '@/lib/trades';

const TURQUOISE = '#14B8A6';

// Top trades shown as prominent cards
const topTrades: Array<{ key: Trade; icon: React.ComponentType<{ size: number; color: string }> }> = [
  { key: 'plumber', icon: Wrench },
  { key: 'electrician', icon: Zap },
  { key: 'gardener', icon: Leaf },
  { key: 'cleaner', icon: Sparkles },
  { key: 'diy', icon: Hammer },
];

// More trades shown when expanded
const moreTrades: Array<{ key: Trade; icon: React.ComponentType<{ size: number; color: string }> }> = [
  { key: 'dog_walker', icon: Dog },
  { key: 'window_cleaner', icon: Droplets },
  { key: 'carpenter', icon: Hammer },
  { key: 'car_valet', icon: Car },
  { key: 'carpet_cleaner', icon: Sparkles },
];

// Step indicator dots
function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <View className="flex-row items-center justify-center gap-2 mb-6">
      {[0, 1, 2].map((step) => (
        <View
          key={step}
          className={`h-1.5 rounded-full ${
            step === currentStep
              ? 'w-8 bg-[#14B8A6]'
              : step < currentStep
                ? 'w-4 bg-[#14B8A6]/40'
                : 'w-4 bg-[#334155]'
          }`}
        />
      ))}
    </View>
  );
}

// Step 1: Welcome + Name
function StepName({
  name,
  onChangeName,
  onNext,
}: {
  name: string;
  onChangeName: (text: string) => void;
  onNext: () => void;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(500)}
      className="flex-1 px-6"
    >
      {/* Logo */}
      <View className="items-center mb-4 mt-2">
        <Image
          source={require('@/assets/tradie-logo.png')}
          style={{ width: 140, height: 140 }}
          resizeMode="contain"
        />
      </View>

      <View className="items-center mb-2">
        <Text className="text-slate-400 text-base text-center">
          The all-in-one app for solo tradies.
        </Text>
      </View>

      {/* Tagline */}
      <View className="flex-row items-center justify-center mb-10">
        {['QUOTE', 'BOOK', 'INVOICE'].map((word, i) => (
          <React.Fragment key={word}>
            <Text
              className="text-[#14B8A6] font-bold text-sm"
              style={{ letterSpacing: 2 }}
            >
              {word}
            </Text>
            {i < 2 && (
              <Text className="text-slate-600 mx-3 font-light">|</Text>
            )}
          </React.Fragment>
        ))}
      </View>

      {/* Name input */}
      <Animated.View entering={FadeInDown.delay(200).duration(500)}>
        <Text className="text-white font-bold text-2xl mb-2">
          What's your name?
        </Text>
        <Text className="text-slate-500 text-sm mb-6">
          We'll use this to personalise your experience
        </Text>

        <View className="flex-row items-center bg-[#1E293B] rounded-xl border border-[#334155] px-4 py-3 mb-8">
          <User size={20} color="#64748B" />
          <TextInput
            className="flex-1 text-white text-lg ml-3"
            placeholder="Your first name"
            placeholderTextColor="#475569"
            value={name}
            onChangeText={onChangeName}
            autoFocus
            returnKeyType="next"
            onSubmitEditing={() => name.trim().length > 0 && onNext()}
            autoCapitalize="words"
          />
        </View>
      </Animated.View>

      {/* Continue button */}
      <Animated.View entering={FadeInUp.delay(400).duration(500)}>
        <Pressable
          onPress={onNext}
          disabled={name.trim().length === 0}
          className="active:opacity-90"
        >
          <LinearGradient
            colors={name.trim().length > 0 ? ['#14B8A6', '#0D9488'] : ['#334155', '#1E293B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 16,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              className={`font-bold text-lg mr-2 ${
                name.trim().length > 0 ? 'text-white' : 'text-slate-500'
              }`}
            >
              Continue
            </Text>
            <ArrowRight size={20} color={name.trim().length > 0 ? '#FFF' : '#64748B'} />
          </LinearGradient>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// Step 2: Trade selection
function StepTrade({
  selectedTrade,
  onSelectTrade,
  onCustomTrade,
}: {
  selectedTrade: Trade | null;
  onSelectTrade: (trade: Trade) => void;
  onCustomTrade: () => void;
}) {
  const [showMore, setShowMore] = useState(false);

  return (
    <Animated.View
      entering={SlideInRight.duration(400)}
      className="flex-1 px-6"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text className="text-white font-bold text-2xl mb-2">
          What's your trade?
        </Text>
        <Text className="text-slate-500 text-sm mb-6">
          This sets up your job types and default pricing
        </Text>
      </Animated.View>

      {/* Top trades - prominent cards */}
      <View className="gap-3 mb-4">
        {topTrades.map((trade, index) => {
          const config = tradeConfigs[trade.key];
          const Icon = trade.icon;
          const isSelected = selectedTrade === trade.key;

          return (
            <Animated.View
              key={trade.key}
              entering={FadeInDown.delay(100 + index * 60).duration(400)}
            >
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onSelectTrade(trade.key);
                }}
                className="active:opacity-90"
              >
                <View
                  className={`flex-row items-center rounded-xl border px-4 py-3.5 ${
                    isSelected
                      ? 'bg-[#14B8A6]/15 border-[#14B8A6]'
                      : 'bg-[#1E293B] border-[#334155]'
                  }`}
                >
                  <View
                    className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                      isSelected ? 'bg-[#14B8A6]/20' : 'bg-[#0F172A]'
                    }`}
                  >
                    <Icon size={20} color={isSelected ? TURQUOISE : '#94A3B8'} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold text-base">
                      {config.label}
                    </Text>
                    <Text className="text-slate-500 text-xs">
                      {config.description}
                    </Text>
                  </View>
                  {isSelected ? (
                    <View className="w-7 h-7 rounded-full bg-[#14B8A6] items-center justify-center">
                      <Check size={14} color="#FFF" />
                    </View>
                  ) : (
                    <View className="w-7 h-7 rounded-full bg-[#0F172A] items-center justify-center">
                      <ChevronRight size={14} color="#64748B" />
                    </View>
                  )}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {/* More trades toggle */}
      {!showMore ? (
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setShowMore(true);
            }}
          >
            <View className="flex-row items-center justify-center py-3">
              <Text className="text-[#14B8A6] font-medium text-sm mr-1">
                More trades
              </Text>
              <ChevronDown size={16} color={TURQUOISE} />
            </View>
          </Pressable>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.duration(300)} className="gap-3 mb-4">
          {moreTrades.map((trade, index) => {
            const config = tradeConfigs[trade.key];
            const Icon = trade.icon;
            const isSelected = selectedTrade === trade.key;

            return (
              <Animated.View
                key={trade.key}
                entering={FadeInDown.delay(index * 50).duration(300)}
              >
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onSelectTrade(trade.key);
                  }}
                  className="active:opacity-90"
                >
                  <View
                    className={`flex-row items-center rounded-xl border px-4 py-3.5 ${
                      isSelected
                        ? 'bg-[#14B8A6]/15 border-[#14B8A6]'
                        : 'bg-[#1E293B] border-[#334155]'
                    }`}
                  >
                    <View
                      className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${
                        isSelected ? 'bg-[#14B8A6]/20' : 'bg-[#0F172A]'
                      }`}
                    >
                      <Icon size={20} color={isSelected ? TURQUOISE : '#94A3B8'} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white font-semibold text-base">
                        {config.label}
                      </Text>
                      <Text className="text-slate-500 text-xs">
                        {config.description}
                      </Text>
                    </View>
                    {isSelected ? (
                      <View className="w-7 h-7 rounded-full bg-[#14B8A6] items-center justify-center">
                        <Check size={14} color="#FFF" />
                      </View>
                    ) : (
                      <View className="w-7 h-7 rounded-full bg-[#0F172A] items-center justify-center">
                        <ChevronRight size={14} color="#64748B" />
                      </View>
                    )}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}

          {/* Custom trade */}
          <Animated.View entering={FadeInDown.delay(moreTrades.length * 50).duration(300)}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onCustomTrade();
              }}
            >
              <View className="flex-row items-center rounded-xl border border-dashed border-[#334155] px-4 py-3.5">
                <View className="w-10 h-10 rounded-xl bg-[#0F172A] items-center justify-center mr-3">
                  <Plus size={20} color={TURQUOISE} />
                </View>
                <Text className="text-slate-400 font-semibold text-base">
                  Add your own trade
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        </Animated.View>
      )}

      <View className="mt-2 items-center">
        <Text className="text-slate-600 text-xs">
          You can change this later in Settings
        </Text>
      </View>
    </Animated.View>
  );
}

// Step 3: Quick business setup
function StepBusiness({
  businessName,
  phone,
  hourlyRate,
  onChangeBusinessName,
  onChangePhone,
  onChangeHourlyRate,
  onFinish,
  onSkip,
  ownerName,
}: {
  businessName: string;
  phone: string;
  hourlyRate: string;
  onChangeBusinessName: (text: string) => void;
  onChangePhone: (text: string) => void;
  onChangeHourlyRate: (text: string) => void;
  onFinish: () => void;
  onSkip: () => void;
  ownerName: string;
}) {
  return (
    <Animated.View
      entering={SlideInRight.duration(400)}
      className="flex-1 px-6"
    >
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text className="text-white font-bold text-2xl mb-2">
          Quick setup
        </Text>
        <Text className="text-slate-500 text-sm mb-6">
          Just the essentials to get you started, {ownerName}
        </Text>
      </Animated.View>

      {/* Business name */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-4">
        <Text className="text-slate-400 text-sm font-medium mb-2">Business name</Text>
        <View className="flex-row items-center bg-[#1E293B] rounded-xl border border-[#334155] px-4 py-3">
          <Building size={18} color="#64748B" />
          <TextInput
            className="flex-1 text-white text-base ml-3"
            placeholder="e.g. Paul's Plumbing"
            placeholderTextColor="#475569"
            value={businessName}
            onChangeText={onChangeBusinessName}
            autoCapitalize="words"
          />
        </View>
      </Animated.View>

      {/* Phone */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-4">
        <Text className="text-slate-400 text-sm font-medium mb-2">Phone number</Text>
        <View className="flex-row items-center bg-[#1E293B] rounded-xl border border-[#334155] px-4 py-3">
          <Phone size={18} color="#64748B" />
          <TextInput
            className="flex-1 text-white text-base ml-3"
            placeholder="07xxx xxxxxx"
            placeholderTextColor="#475569"
            value={phone}
            onChangeText={onChangePhone}
            keyboardType="phone-pad"
          />
        </View>
      </Animated.View>

      {/* Hourly rate */}
      <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-8">
        <Text className="text-slate-400 text-sm font-medium mb-2">Hourly rate</Text>
        <View className="flex-row items-center bg-[#1E293B] rounded-xl border border-[#334155] px-4 py-3">
          <PoundSterling size={18} color="#64748B" />
          <TextInput
            className="flex-1 text-white text-base ml-3"
            placeholder="60"
            placeholderTextColor="#475569"
            value={hourlyRate}
            onChangeText={onChangeHourlyRate}
            keyboardType="numeric"
          />
          <Text className="text-slate-500 text-sm">/hour</Text>
        </View>
      </Animated.View>

      {/* Finish button */}
      <Animated.View entering={FadeInUp.delay(400).duration(400)}>
        <Pressable onPress={onFinish} className="active:opacity-90">
          <LinearGradient
            colors={['#14B8A6', '#0D9488']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              paddingVertical: 16,
              borderRadius: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text className="text-white font-bold text-lg mr-2">
              Let's go!
            </Text>
            <ArrowRight size={20} color="#FFF" />
          </LinearGradient>
        </Pressable>

        {/* Skip */}
        <Pressable onPress={onSkip} className="mt-4 py-3">
          <Text className="text-slate-500 text-center text-sm">
            Skip — I'll set this up later
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { setTrade, updateSettings } = useTradeStore();
  const [step, setStep] = useState(0);
  const [navigating, setNavigating] = useState(false);

  // Step 1 state
  const [ownerName, setOwnerName] = useState('');

  // Step 2 state
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  // Step 3 state
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');

  const handleNameNext = useCallback(() => {
    if (ownerName.trim().length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(1);
  }, [ownerName]);

  const handleSelectTrade = useCallback(
    (trade: Trade) => {
      if (navigating) return;
      setSelectedTrade(trade);
      setTrade(trade);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Move to step 3 after brief delay
      setTimeout(() => {
        setStep(2);
      }, 300);
    },
    [navigating, setTrade]
  );

  const handleCustomTrade = useCallback(() => {
    handleSelectTrade('custom');
  }, [handleSelectTrade]);

  const finishOnboarding = useCallback(
    (skipSetup: boolean) => {
      if (navigating) return;
      setNavigating(true);

      // Save owner name always
      const updates: Record<string, string | number> = {
        ownerName: ownerName.trim(),
      };

      if (!skipSetup) {
        if (businessName.trim()) updates.businessName = businessName.trim();
        if (phone.trim()) updates.phone = phone.trim();
        if (hourlyRate.trim()) {
          const rate = parseInt(hourlyRate, 10);
          if (!isNaN(rate) && rate > 0) updates.hourlyRate = rate;
        }
      }

      updateSettings(updates);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    },
    [navigating, ownerName, businessName, phone, hourlyRate, updateSettings, router]
  );

  return (
    <SafeAreaView className="flex-1 bg-[#0F172A]">
      {/* Subtle top gradient */}
      <LinearGradient
        colors={['#14B8A620', '#0F172A00']}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 300,
        }}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step indicator */}
          <View className="pt-4">
            <StepIndicator currentStep={step} />
          </View>

          {step === 0 && (
            <StepName
              name={ownerName}
              onChangeName={setOwnerName}
              onNext={handleNameNext}
            />
          )}

          {step === 1 && (
            <StepTrade
              selectedTrade={selectedTrade}
              onSelectTrade={handleSelectTrade}
              onCustomTrade={handleCustomTrade}
            />
          )}

          {step === 2 && (
            <StepBusiness
              businessName={businessName}
              phone={phone}
              hourlyRate={hourlyRate}
              onChangeBusinessName={setBusinessName}
              onChangePhone={setPhone}
              onChangeHourlyRate={setHourlyRate}
              onFinish={() => finishOnboarding(false)}
              onSkip={() => finishOnboarding(true)}
              ownerName={ownerName.trim().split(' ')[0]}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
