import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, Image, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Wrench,
  Zap,
  Leaf,
  Sparkles,
  ChevronRight,
  Dog,
  Droplets,
  Hammer,
  Car,
  Plus,
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useTradeStore } from '@/lib/store';
import { Trade, tradeConfigs } from '@/lib/trades';

const trades: Array<{
  key: Trade;
  icon: React.ReactNode;
}> = [
  { key: 'plumber', icon: <Wrench size={18} color="#94A3B8" /> },
  { key: 'electrician', icon: <Zap size={18} color="#94A3B8" /> },
  { key: 'gardener', icon: <Leaf size={18} color="#94A3B8" /> },
  { key: 'cleaner', icon: <Sparkles size={18} color="#94A3B8" /> },
  { key: 'dog_walker', icon: <Dog size={18} color="#94A3B8" /> },
  { key: 'window_cleaner', icon: <Droplets size={18} color="#94A3B8" /> },
  { key: 'carpenter', icon: <Hammer size={18} color="#94A3B8" /> },
  { key: 'diy', icon: <Wrench size={18} color="#94A3B8" /> },
  { key: 'car_valet', icon: <Car size={18} color="#94A3B8" /> },
  { key: 'carpet_cleaner', icon: <Sparkles size={18} color="#94A3B8" /> },
];

function TradeCard({
  trade,
  index,
  onSelect,
  selected,
  disabled,
}: {
  trade: (typeof trades)[number];
  index: number;
  onSelect: (t: Trade) => void;
  selected: boolean;
  disabled: boolean;
}) {
  const config = tradeConfigs[trade.key];
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handlePress = () => {
    if (disabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.95, { damping: 12, stiffness: 200 }, () => {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    });
    onSelect(trade.key);
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(300 + index * 80)
        .duration(500)
        .springify()
        .damping(16)}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        <Animated.View style={animatedStyle}>
          <View
            className={`flex-row items-center rounded-xl border px-4 py-3 ${
              selected
                ? 'bg-[#14B8A6]/10 border-[#14B8A6]'
                : 'bg-[#1E293B] border-[#334155]'
            }`}
          >
            {/* Icon */}
            <View className="w-9 h-9 rounded-lg bg-[#0F172A] items-center justify-center mr-3">
              {trade.icon}
            </View>

            {/* Text */}
            <View className="flex-1">
              <Text className="text-white font-semibold text-base">
                {config.label}
              </Text>
              <Text className="text-slate-500 text-xs">
                {config.description}
              </Text>
            </View>

            {/* Arrow */}
            <View className="w-7 h-7 rounded-full bg-[#14B8A6] items-center justify-center">
              <ChevronRight size={14} color="#0F172A" />
            </View>
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const { setTrade } = useTradeStore();
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customTradeName, setCustomTradeName] = useState('');

  const handleSelectTrade = useCallback(
    (trade: Trade) => {
      if (navigating) return;
      setSelectedTrade(trade);
      setNavigating(true);

      setTimeout(() => {
        setTrade(trade);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace('/(tabs)');
      }, 400);
    },
    [navigating, setTrade, router]
  );

  const handleCustomTrade = useCallback(() => {
    if (navigating) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!showCustomInput) {
      setShowCustomInput(true);
      return;
    }
    if (customTradeName.trim().length > 0) {
      handleSelectTrade('custom');
    }
  }, [navigating, showCustomInput, customTradeName, handleSelectTrade]);

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
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo */}
          <Animated.View
            entering={FadeInDown.delay(0).duration(600).springify().damping(18)}
            className="items-center mb-2 mt-4"
          >
            <Image
              source={require('@/assets/tradie-logo.png')}
              style={{ width: 160, height: 160 }}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View
            entering={FadeInDown.delay(50).duration(500).springify().damping(18)}
            className="items-center mb-2"
          >
            <Text className="text-slate-400 text-base text-center">
              The all-in-one app for solo tradies.
            </Text>
          </Animated.View>

          {/* Tagline */}
          <Animated.View
            entering={FadeInDown.delay(150).duration(500).springify().damping(18)}
            className="flex-row items-center justify-center mb-8"
          >
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
          </Animated.View>

          {/* Trade selection prompt */}
          <Animated.View
            entering={FadeInDown.delay(220).duration(500).springify().damping(18)}
            className="mb-4"
          >
            <Text className="text-white font-bold text-xl">
              What's your trade?
            </Text>
          </Animated.View>

          {/* Trade cards */}
          <View className="gap-2.5">
            {trades.map((trade, index) => (
              <TradeCard
                key={trade.key}
                trade={trade}
                index={index}
                onSelect={handleSelectTrade}
                selected={selectedTrade === trade.key}
                disabled={navigating}
              />
            ))}

            {/* Add custom trade button */}
            <Animated.View
              entering={FadeInDown.delay(300 + trades.length * 80)
                .duration(500)
                .springify()
                .damping(16)}
            >
              {!showCustomInput ? (
                <Pressable onPress={handleCustomTrade} disabled={navigating}>
                  <View className="flex-row items-center rounded-xl border border-dashed border-[#334155] px-4 py-3">
                    <View className="w-9 h-9 rounded-lg bg-[#0F172A] items-center justify-center mr-3">
                      <Plus size={18} color="#14B8A6" />
                    </View>
                    <Text className="text-slate-400 font-semibold text-base">
                      Add your own trade
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <View className="rounded-xl border border-[#14B8A6] bg-[#14B8A6]/10 px-4 py-3">
                  <Text className="text-slate-400 text-xs mb-2">Enter your trade name</Text>
                  <View className="flex-row items-center">
                    <TextInput
                      className="flex-1 text-white text-base bg-[#0F172A] rounded-lg px-3 py-2 mr-3"
                      placeholder="e.g. Locksmith, Painter..."
                      placeholderTextColor="#475569"
                      value={customTradeName}
                      onChangeText={setCustomTradeName}
                      autoFocus
                      returnKeyType="go"
                      onSubmitEditing={handleCustomTrade}
                    />
                    <Pressable
                      onPress={handleCustomTrade}
                      disabled={customTradeName.trim().length === 0}
                    >
                      <View
                        className={`w-9 h-9 rounded-full items-center justify-center ${
                          customTradeName.trim().length > 0
                            ? 'bg-[#14B8A6]'
                            : 'bg-[#334155]'
                        }`}
                      >
                        <ChevronRight size={16} color={customTradeName.trim().length > 0 ? '#0F172A' : '#64748B'} />
                      </View>
                    </Pressable>
                  </View>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Footer */}
          <Animated.View
            entering={FadeInDown.delay(700).duration(500)}
            className="mt-6 items-center"
          >
            <Text className="text-slate-600 text-xs text-center">
              You can change this later in Settings
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
