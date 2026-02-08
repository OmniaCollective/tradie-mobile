import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTradeStore } from '@/lib/store';
import { Trade, tradeConfigs } from '@/lib/trades';

const TURQUOISE = '#14B8A6';

export default function OnboardingScreen() {
  const router = useRouter();
  const { setTrade } = useTradeStore();

  const handleSelectTrade = (trade: Trade) => {
    setTrade(trade);
    // Navigate to main app
    router.replace('/(tabs)');
  };

  const trades: Trade[] = ['plumber', 'electrician', 'gardener', 'cleaner'];

  return (
    <SafeAreaView className="flex-1 bg-[#0F172A]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-4 py-8">
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="items-center mb-8"
          >
            <Text className="text-[#14B8A6] font-bold text-4xl mb-2">TRADIE</Text>
            <Text className="text-slate-400 text-center text-lg">
              Automation-first job management for tradespeople
            </Text>
          </Animated.View>

          {/* Subheading */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(400)}
            className="mb-8"
          >
            <Text className="text-white font-bold text-2xl mb-2">
              What's your trade?
            </Text>
            <Text className="text-slate-400 text-base">
              Choose your profession to get started
            </Text>
          </Animated.View>

          {/* Trade Options */}
          <View className="gap-4 mb-8">
            {trades.map((trade, index) => {
              const config = tradeConfigs[trade];
              return (
                <Animated.View
                  key={trade}
                  entering={FadeInDown.delay(200 + index * 100).duration(400)}
                >
                  <Pressable
                    onPress={() => handleSelectTrade(trade)}
                    className="bg-[#1E293B] rounded-2xl border border-[#334155] p-6 active:opacity-70"
                  >
                    <View className="flex-row items-center">
                      <Text className="text-5xl mr-4">{config.icon}</Text>
                      <View className="flex-1">
                        <Text className="text-white font-bold text-xl">
                          {config.label}
                        </Text>
                        <Text className="text-slate-400 text-sm mt-1">
                          {config.description}
                        </Text>
                      </View>
                      <View className="w-6 h-6 rounded-full border-2 border-[#334155]" />
                    </View>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>

          {/* Benefits */}
          <Animated.View
            entering={FadeInDown.delay(600).duration(400)}
            className="bg-[#1E293B] rounded-2xl border border-[#334155] p-6"
          >
            <Text className="text-white font-bold text-lg mb-4">
              What you get:
            </Text>
            <View className="gap-3">
              {[
                'Customer self-serve booking & quotes',
                'Automatic invoice generation',
                'Calendar scheduling',
                'To-do list & notes',
              ].map((benefit, i) => (
                <View key={i} className="flex-row items-center">
                  <Check size={20} color={TURQUOISE} />
                  <Text className="text-slate-300 ml-3">{benefit}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
