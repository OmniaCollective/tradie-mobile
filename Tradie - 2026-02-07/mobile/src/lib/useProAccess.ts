/**
 * Pro Access Hook
 *
 * Provides centralized access control for Pro features with usage limits.
 * Free tier limits: 15 booking links/month, 20 customers total
 */

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { hasEntitlement, isRevenueCatEnabled } from './revenuecatClient';
import { useTradeStore } from './store';

// Free tier limits
export const FREE_TIER_LIMITS = {
  bookingLinksPerMonth: 15,
  maxCustomers: 20,
} as const;

export interface ProAccessState {
  isPro: boolean;
  isLoading: boolean;
  // Usage stats
  bookingLinksSentThisMonth: number;
  totalCustomers: number;
  // Limit checks
  canSendBookingLink: boolean;
  canAddCustomer: boolean;
  // Remaining
  bookingLinksRemaining: number;
  customersRemaining: number;
}

/**
 * Hook to check Pro access status and usage limits
 */
export function useProAccess(): ProAccessState {
  const bookingLinksSentThisMonth = useTradeStore((s) => s.bookingLinksSentThisMonth);
  const totalCustomers = useTradeStore((s) => s.customers.length);

  // Query RevenueCat for entitlement status
  const { data: isPro = false, isLoading } = useQuery({
    queryKey: ['proEntitlement'],
    queryFn: async () => {
      if (!isRevenueCatEnabled()) {
        return false;
      }
      const result = await hasEntitlement('pro');
      return result.ok ? result.data : false;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    refetchOnWindowFocus: true,
  });

  // Calculate limits
  const canSendBookingLink = isPro || bookingLinksSentThisMonth < FREE_TIER_LIMITS.bookingLinksPerMonth;
  const canAddCustomer = isPro || totalCustomers < FREE_TIER_LIMITS.maxCustomers;

  const bookingLinksRemaining = isPro
    ? Infinity
    : Math.max(0, FREE_TIER_LIMITS.bookingLinksPerMonth - bookingLinksSentThisMonth);
  const customersRemaining = isPro
    ? Infinity
    : Math.max(0, FREE_TIER_LIMITS.maxCustomers - totalCustomers);

  return {
    isPro,
    isLoading,
    bookingLinksSentThisMonth,
    totalCustomers,
    canSendBookingLink,
    canAddCustomer,
    bookingLinksRemaining,
    customersRemaining,
  };
}

/**
 * Hook to check if a specific feature requires Pro
 */
export function useFeatureGate(feature: 'bookingLinks' | 'customers'): {
  isAllowed: boolean;
  isLoading: boolean;
  reason?: string;
} {
  const { isPro, isLoading, canSendBookingLink, canAddCustomer, bookingLinksRemaining, customersRemaining } = useProAccess();

  if (isLoading) {
    return { isAllowed: true, isLoading: true };
  }

  if (isPro) {
    return { isAllowed: true, isLoading: false };
  }

  switch (feature) {
    case 'bookingLinks':
      return {
        isAllowed: canSendBookingLink,
        isLoading: false,
        reason: canSendBookingLink
          ? undefined
          : `You've used all ${FREE_TIER_LIMITS.bookingLinksPerMonth} booking links this month`,
      };
    case 'customers':
      return {
        isAllowed: canAddCustomer,
        isLoading: false,
        reason: canAddCustomer
          ? undefined
          : `You've reached the ${FREE_TIER_LIMITS.maxCustomers} customer limit`,
      };
    default:
      return { isAllowed: true, isLoading: false };
  }
}
