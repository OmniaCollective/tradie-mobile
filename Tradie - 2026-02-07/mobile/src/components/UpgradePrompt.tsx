import React from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Crown, X, Zap, Users, Send } from 'lucide-react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { FREE_TIER_LIMITS } from '@/lib/useProAccess';

const TURQUOISE = '#14B8A6';

interface UpgradePromptProps {
  visible: boolean;
  onClose: () => void;
  feature: 'bookingLinks' | 'customers';
  currentUsage?: number;
}

export function UpgradePrompt({ visible, onClose, feature, currentUsage }: UpgradePromptProps) {
  const router = useRouter();

  const handleUpgrade = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    router.push('/paywall');
  };

  const getContent = () => {
    switch (feature) {
      case 'bookingLinks':
        return {
          icon: <Send size={32} color={TURQUOISE} />,
          title: 'Booking Link Limit Reached',
          description: `You've sent ${currentUsage ?? FREE_TIER_LIMITS.bookingLinksPerMonth} of ${FREE_TIER_LIMITS.bookingLinksPerMonth} free booking links this month.`,
          benefit: 'Upgrade to Pro for unlimited booking links',
        };
      case 'customers':
        return {
          icon: <Users size={32} color={TURQUOISE} />,
          title: 'Customer Limit Reached',
          description: `You've added ${currentUsage ?? FREE_TIER_LIMITS.maxCustomers} of ${FREE_TIER_LIMITS.maxCustomers} free customers.`,
          benefit: 'Upgrade to Pro for unlimited customers',
        };
    }
  };

  const content = getContent();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Animated.View
        entering={FadeIn.duration(200)}
        className="flex-1 bg-black/70 justify-end"
      >
        <Pressable className="flex-1" onPress={onClose} />
        <Animated.View
          entering={SlideInDown.duration(300).springify()}
          className="bg-[#1E293B] rounded-t-3xl"
        >
          {/* Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 rounded-full bg-[#334155]" />
          </View>

          {/* Close button */}
          <Pressable
            onPress={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-[#334155] items-center justify-center"
          >
            <X size={16} color="#94A3B8" />
          </Pressable>

          <View className="px-6 pb-8 pt-4">
            {/* Icon */}
            <View className="w-16 h-16 rounded-2xl bg-[#14B8A6]/20 items-center justify-center self-center mb-4">
              {content.icon}
            </View>

            {/* Title */}
            <Text className="text-white font-bold text-xl text-center mb-2">
              {content.title}
            </Text>

            {/* Description */}
            <Text className="text-slate-400 text-center mb-6">
              {content.description}
            </Text>

            {/* Benefit */}
            <View className="bg-[#0F172A] rounded-xl p-4 mb-6 flex-row items-center">
              <View className="w-10 h-10 rounded-full bg-[#14B8A6]/20 items-center justify-center mr-3">
                <Zap size={20} color={TURQUOISE} />
              </View>
              <Text className="text-white flex-1">{content.benefit}</Text>
            </View>

            {/* Pro features preview */}
            <View className="mb-6">
              <Text className="text-slate-500 text-xs uppercase tracking-wide mb-3">
                Pro includes
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {['Unlimited links', 'Unlimited customers', 'Priority support', 'SMS reminders'].map((feature) => (
                  <View
                    key={feature}
                    className="bg-[#334155] rounded-full px-3 py-1.5"
                  >
                    <Text className="text-slate-300 text-xs">{feature}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Upgrade button */}
            <Pressable
              onPress={handleUpgrade}
              className="bg-[#14B8A6] rounded-xl p-4 flex-row items-center justify-center active:opacity-80"
            >
              <Crown size={20} color="#FFF" />
              <Text className="text-white font-bold text-base ml-2">
                Upgrade to Pro
              </Text>
            </Pressable>

            {/* Maybe later */}
            <Pressable onPress={onClose} className="mt-4 py-2">
              <Text className="text-slate-500 text-center">Maybe later</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
