/**
 * Payment integration module for TRADIE app
 *
 * This module will handle RevenueCat integration for subscriptions
 * once the user connects their RevenueCat account via the PAYMENTS tab.
 *
 * Planned features:
 * - TRADIE Pro subscription (monthly/yearly)
 * - Unlock unlimited bookings
 * - Priority support
 * - Advanced analytics
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SUBSCRIPTION_KEY = 'tradie-subscription-status';

export type SubscriptionTier = 'free' | 'pro';

export interface SubscriptionStatus {
  tier: SubscriptionTier;
  isActive: boolean;
  expiresAt?: string;
  productId?: string;
}

const defaultStatus: SubscriptionStatus = {
  tier: 'free',
  isActive: false,
};

/**
 * Get current subscription status
 * In production, this will check RevenueCat for active entitlements
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  try {
    const stored = await AsyncStorage.getItem(SUBSCRIPTION_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error getting subscription status:', error);
  }
  return defaultStatus;
}

/**
 * Check if user has Pro access
 */
export async function hasProAccess(): Promise<boolean> {
  const status = await getSubscriptionStatus();
  return status.tier === 'pro' && status.isActive;
}

/**
 * Pro features that will be unlocked:
 * - Unlimited booking links per month (free: 10)
 * - Custom branding on booking pages
 * - Priority customer support
 * - Advanced job analytics
 * - Automatic job reminders
 * - Multi-device sync
 */
export const PRO_FEATURES = [
  {
    title: 'Unlimited Bookings',
    description: 'Send unlimited booking links to customers',
    icon: 'send',
  },
  {
    title: 'Custom Branding',
    description: 'Add your logo to booking pages',
    icon: 'palette',
  },
  {
    title: 'Priority Support',
    description: 'Get help when you need it',
    icon: 'headphones',
  },
  {
    title: 'Advanced Analytics',
    description: 'Track your business performance',
    icon: 'chart',
  },
  {
    title: 'Auto Reminders',
    description: 'Automatic SMS reminders for jobs',
    icon: 'bell',
  },
  {
    title: 'Multi-Device Sync',
    description: 'Access from any device',
    icon: 'smartphone',
  },
];

/**
 * Free tier limits
 */
export const FREE_TIER_LIMITS = {
  bookingLinksPerMonth: 10,
  maxCustomers: 50,
  maxJobs: 100,
};
