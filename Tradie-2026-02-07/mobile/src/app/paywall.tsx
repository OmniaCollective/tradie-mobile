import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Check,
  Zap,
  Send,
  BarChart3,
  Bell,
  Smartphone,
  Palette,
  Infinity,
} from 'lucide-react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  isRevenueCatEnabled,
} from '@/lib/revenuecatClient';
import type { PurchasesPackage } from 'react-native-purchases';
import { ConfirmModal } from '@/components/ConfirmModal';

const TURQUOISE = '#14B8A6';

const PRO_FEATURES = [
  {
    icon: Send,
    title: 'Unlimited Bookings',
    description: 'Send unlimited booking links',
  },
  {
    icon: Palette,
    title: 'Custom Branding',
    description: 'Your logo on booking pages',
  },
  {
    icon: BarChart3,
    title: 'Business Analytics',
    description: 'Track your performance',
  },
  {
    icon: Bell,
    title: 'Auto Reminders',
    description: 'SMS reminders for jobs',
  },
  {
    icon: Smartphone,
    title: 'Multi-Device Sync',
    description: 'Access from anywhere',
  },
];

type PlanType = 'monthly' | 'yearly' | 'lifetime';

export default function PaywallScreen() {
  const router = useRouter();
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('yearly');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [modal, setModal] = useState<{ title: string; message: string; variant?: 'default' | 'success' | 'error' | 'warning'; onDismissAction?: () => void } | null>(null);
  const [packages, setPackages] = useState<{
    monthly: PurchasesPackage | null;
    yearly: PurchasesPackage | null;
    lifetime: PurchasesPackage | null;
  }>({ monthly: null, yearly: null, lifetime: null });

  useEffect(() => {
    loadOfferings();
  }, []);

  const loadOfferings = async () => {
    if (!isRevenueCatEnabled()) {
      setLoading(false);
      setModal({ title: 'Subscriptions Unavailable', message: 'In-app purchases are not available right now. Please try again later.', variant: 'error', onDismissAction: () => router.back() });
      return;
    }

    const result = await getOfferings();
    if (result.ok && result.data.current) {
      const availablePackages = result.data.current.availablePackages;
      setPackages({
        monthly: availablePackages.find(p => p.identifier === '$rc_monthly') || null,
        yearly: availablePackages.find(p => p.identifier === '$rc_annual') || null,
        lifetime: availablePackages.find(p => p.identifier === '$rc_lifetime') || null,
      });
    } else if (!result.ok) {
      console.log('Failed to load offerings:', result);
    }
    setLoading(false);
  };

  const handlePurchase = async () => {
    const pkg = selectedPlan === 'monthly'
      ? packages.monthly
      : selectedPlan === 'yearly'
        ? packages.yearly
        : packages.lifetime;

    if (!pkg) {
      console.log('[Paywall] No package found for plan:', selectedPlan, 'packages:', {
        monthly: !!packages.monthly,
        yearly: !!packages.yearly,
        lifetime: !!packages.lifetime,
      });
      setModal({ title: 'Unavailable', message: 'This subscription plan is not available right now. Please try again later.', variant: 'error' });
      return;
    }

    setPurchasing(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await purchasePackage(pkg);
    if (result.ok) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setModal({ title: 'Welcome to Pro!', message: 'You now have access to all premium features.', variant: 'success', onDismissAction: () => router.back() });
    } else if (result.reason === 'sdk_error') {
      const errorMessage = result.error instanceof Error ? result.error.message : 'Purchase failed';
      // Don't show error for user cancellation
      if (!errorMessage.includes('cancel') && !errorMessage.includes('Cancel')) {
        setModal({ title: 'Purchase Failed', message: 'Something went wrong with the purchase. Please try again.', variant: 'error' });
      }
    } else if (result.reason === 'not_configured') {
      setModal({ title: 'Unavailable', message: 'In-app purchases are not available right now. Please try again later.', variant: 'error' });
    }
    setPurchasing(false);
  };

  const handleRestore = async () => {
    setLoading(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const result = await restorePurchases();
    if (result.ok) {
      const hasProEntitlement = result.data.entitlements.active?.['pro'];
      if (hasProEntitlement) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModal({ title: 'Restored!', message: 'Your Pro subscription has been restored.', variant: 'success', onDismissAction: () => router.back() });
      } else {
        setModal({ title: 'No Subscription Found', message: "We couldn't find an active subscription to restore.", variant: 'warning' });
      }
    } else {
      setModal({ title: 'Error', message: 'Failed to restore purchases. Please try again.', variant: 'error' });
    }
    setLoading(false);
  };

  const monthlyPrice = packages.monthly?.product.priceString || '£19.99';
  const yearlyPrice = packages.yearly?.product.priceString || '£99.00';
  const lifetimePrice = packages.lifetime?.product.priceString || '£199.00';
  const yearlyMonthly = packages.yearly?.product.price
    ? `£${(packages.yearly.product.price / 12).toFixed(2)}`
    : '£8.25';

  // Check for trial period
  const monthlyTrial = packages.monthly?.product.introPrice;
  const yearlyTrial = packages.yearly?.product.introPrice;
  const hasMonthlyTrial = monthlyTrial?.price === 0;
  const hasYearlyTrial = yearlyTrial?.price === 0;

  // Calculate savings
  const yearlySavings = Math.round((1 - (99 / (19.99 * 12))) * 100);

  return (
    <View className="flex-1 bg-[#0F172A]">
      <LinearGradient
        colors={['#0F172A', '#134E4A', '#0F172A']}
        locations={[0, 0.5, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 400 }}
      />

      <SafeAreaView className="flex-1">
        {/* Close Button */}
        <Pressable
          onPress={() => router.back()}
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 items-center justify-center"
        >
          <X size={20} color="#FFF" />
        </Pressable>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.delay(100).duration(600)}
            className="items-center pt-8 pb-6 px-6"
          >
            <Text className="text-white font-bold text-3xl text-center">
              Upgrade to Pro
            </Text>
            <Text className="text-slate-400 text-center mt-2 text-base">
              Unlock the full power of TRADIE
            </Text>
          </Animated.View>

          {/* Features */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(600)}
            className="px-6 mb-6"
          >
            <View className="bg-white/5 rounded-2xl border border-white/10 p-4">
              {PRO_FEATURES.map((feature, index) => (
                <View
                  key={feature.title}
                  className={`flex-row items-center py-3 ${
                    index < PRO_FEATURES.length - 1 ? 'border-b border-white/5' : ''
                  }`}
                >
                  <View className="w-10 h-10 rounded-xl bg-[#14B8A6]/20 items-center justify-center mr-4">
                    <feature.icon size={20} color={TURQUOISE} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-white font-semibold">{feature.title}</Text>
                    <Text className="text-slate-500 text-sm">{feature.description}</Text>
                  </View>
                  <Check size={18} color={TURQUOISE} />
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Pricing Plans */}
          <Animated.View
            entering={FadeInDown.delay(300).duration(600)}
            className="px-6 mb-6"
          >
            <Text className="text-white font-semibold text-lg mb-4">Choose Your Plan</Text>

            {/* Lifetime Plan */}
            <Pressable
              onPress={() => {
                setSelectedPlan('lifetime');
                Haptics.selectionAsync();
              }}
              className={`rounded-2xl border-2 p-4 mb-3 relative overflow-hidden ${
                selectedPlan === 'lifetime'
                  ? 'border-[#FCD34D] bg-[#FCD34D]/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              {/* Best Value Badge */}
              <View className="absolute top-0 right-0 bg-[#FCD34D] px-3 py-1 rounded-bl-xl">
                <Text className="text-[#0F172A] text-xs font-bold">BEST VALUE</Text>
              </View>

              <View className="flex-row items-center">
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
                    selectedPlan === 'lifetime'
                      ? 'border-[#FCD34D] bg-[#FCD34D]'
                      : 'border-slate-500'
                  }`}
                >
                  {selectedPlan === 'lifetime' && <Check size={14} color="#0F172A" />}
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="text-white font-bold text-lg">Lifetime</Text>
                    <Infinity size={16} color="#FCD34D" className="ml-2" />
                  </View>
                  <Text className="text-slate-400 text-sm">
                    Pay once, own forever
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-white font-bold text-xl">{lifetimePrice}</Text>
                  <Text className="text-slate-500 text-xs">one-time</Text>
                </View>
              </View>
            </Pressable>

            {/* Yearly Plan */}
            <Pressable
              onPress={() => {
                setSelectedPlan('yearly');
                Haptics.selectionAsync();
              }}
              className={`rounded-2xl border-2 p-4 mb-3 relative overflow-hidden ${
                selectedPlan === 'yearly'
                  ? 'border-[#14B8A6] bg-[#14B8A6]/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              {/* Save Badge */}
              <View className="absolute top-0 right-0 bg-[#14B8A6] px-3 py-1 rounded-bl-xl">
                <Text className="text-white text-xs font-bold">SAVE {yearlySavings}%</Text>
              </View>

              <View className="flex-row items-center">
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
                    selectedPlan === 'yearly'
                      ? 'border-[#14B8A6] bg-[#14B8A6]'
                      : 'border-slate-500'
                  }`}
                >
                  {selectedPlan === 'yearly' && <Check size={14} color="#FFF" />}
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-lg">Yearly</Text>
                  <Text className="text-slate-400 text-sm">
                    {hasYearlyTrial ? '1 month free, then ' : ''}{yearlyMonthly}/month
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-white font-bold text-xl">{yearlyPrice}</Text>
                  <Text className="text-slate-500 text-xs">/year</Text>
                </View>
              </View>
            </Pressable>

            {/* Monthly Plan */}
            <Pressable
              onPress={() => {
                setSelectedPlan('monthly');
                Haptics.selectionAsync();
              }}
              className={`rounded-2xl border-2 p-4 ${
                selectedPlan === 'monthly'
                  ? 'border-[#14B8A6] bg-[#14B8A6]/10'
                  : 'border-white/10 bg-white/5'
              }`}
            >
              <View className="flex-row items-center">
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center mr-3 ${
                    selectedPlan === 'monthly'
                      ? 'border-[#14B8A6] bg-[#14B8A6]'
                      : 'border-slate-500'
                  }`}
                >
                  {selectedPlan === 'monthly' && <Check size={14} color="#FFF" />}
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-lg">Monthly</Text>
                  <Text className="text-slate-400 text-sm">
                    {hasMonthlyTrial ? '1 month free trial' : 'Cancel anytime'}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="text-white font-bold text-xl">{monthlyPrice}</Text>
                  <Text className="text-slate-500 text-xs">/month</Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* CTA Button */}
          <Animated.View
            entering={FadeInUp.delay(400).duration(600)}
            className="px-6"
          >
            <Pressable
              onPress={handlePurchase}
              disabled={purchasing || loading}
              className="rounded-2xl overflow-hidden active:opacity-90"
            >
              <LinearGradient
                colors={selectedPlan === 'lifetime' ? ['#FCD34D', '#F59E0B'] : ['#14B8A6', '#0D9488']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 18, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }}
              >
                {purchasing ? (
                  <ActivityIndicator color={selectedPlan === 'lifetime' ? '#0F172A' : '#FFF'} />
                ) : (
                  <>
                    <Zap size={20} color={selectedPlan === 'lifetime' ? '#0F172A' : '#FFF'} fill={selectedPlan === 'lifetime' ? '#0F172A' : '#FFF'} />
                    <Text className={`font-bold text-lg ml-2 ${selectedPlan === 'lifetime' ? 'text-[#0F172A]' : 'text-white'}`}>
                      {selectedPlan === 'lifetime'
                        ? 'Get Lifetime Access'
                        : (selectedPlan === 'monthly' && hasMonthlyTrial) || (selectedPlan === 'yearly' && hasYearlyTrial)
                          ? 'Start Free Trial'
                          : 'Start Pro Now'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {/* Restore Purchases */}
            <Pressable
              onPress={handleRestore}
              disabled={loading}
              className="mt-4 py-3"
            >
              <Text className="text-slate-400 text-center text-sm">
                Already subscribed? <Text className="text-[#14B8A6] font-medium">Restore Purchase</Text>
              </Text>
            </Pressable>

            {/* Terms */}
            <Text className="text-slate-600 text-xs text-center mt-4 px-4">
              {selectedPlan === 'lifetime'
                ? 'One-time payment. Lifetime access to all Pro features.'
                : (selectedPlan === 'monthly' && hasMonthlyTrial) || (selectedPlan === 'yearly' && hasYearlyTrial)
                  ? 'Free for 1 month, then auto-renews. Cancel anytime before the trial ends to avoid being charged.'
                  : 'Payment will be charged to your Apple ID account. Subscription automatically renews unless cancelled at least 24 hours before the end of the current period.'}
            </Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {modal && (
        <ConfirmModal
          visible={!!modal}
          title={modal.title}
          message={modal.message}
          variant={modal.variant}
          onDismiss={() => {
            const action = modal.onDismissAction;
            setModal(null);
            action?.();
          }}
        />
      )}
    </View>
  );
}
