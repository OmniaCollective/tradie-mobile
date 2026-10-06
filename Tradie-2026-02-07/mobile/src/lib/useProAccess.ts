/**
 * Pro access and free-plan limits (offer agreed 2026-10-06, brand/BRAND-BRIEF.md).
 *
 * Free: unlimited jobs, customers, quotes and booking invites; 3 invoices a
 * calendar month; 3 voice jobs in total (counted on the server, see server/).
 * Pro: unlimited invoices, tax set-aside and VAT tracker, expenses and receipts,
 * tax-year exports, unlimited voice jobs.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { hasEntitlement, isRevenueCatEnabled } from './revenuecatClient';
import { useTradeStore } from './store';

export const FREE_LIMITS = {
  invoicesPerMonth: 3,
  voiceJobs: 3,
} as const;

/** Shared React Query key, so a purchase can refresh every screen at once. */
export const PRO_QUERY_KEY = ['proEntitlement'] as const;

/** Dev-only switch to preview Pro screens without a purchase (set in .env, never in EAS). */
const DEV_FORCE_PRO = __DEV__ && process.env.EXPO_PUBLIC_DEV_FORCE_PRO === '1';

async function fetchIsPro(): Promise<boolean> {
  if (DEV_FORCE_PRO) return true;
  if (!isRevenueCatEnabled()) return false;
  const result = await hasEntitlement('pro');
  return result.ok ? result.data : false;
}

export interface ProAccess {
  isPro: boolean;
  isLoading: boolean;
  invoicesThisMonth: number;
  /** Invoices a free user can still create this month (Infinity for Pro). */
  invoicesLeft: number;
  canCreateInvoice: boolean;
}

export function useProAccess(): ProAccess {
  const { data: isPro = false, isLoading } = useQuery({
    queryKey: PRO_QUERY_KEY,
    queryFn: fetchIsPro,
    staleTime: 1000 * 60 * 5,
  });

  const invoicesThisMonth = useTradeStore((s) => {
    const now = new Date();
    return s.invoices.filter((i) => {
      const d = new Date(i.createdAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  });

  const invoicesLeft = isPro ? Infinity : Math.max(0, FREE_LIMITS.invoicesPerMonth - invoicesThisMonth);

  return {
    isPro,
    // While RevenueCat answers, don't block anyone: limits apply once we know.
    isLoading,
    invoicesThisMonth,
    invoicesLeft,
    canCreateInvoice: isLoading || invoicesLeft > 0,
  };
}

/** Re-check Pro right away, e.g. after a purchase or restore. */
export function useRefreshPro() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries({ queryKey: PRO_QUERY_KEY }), [queryClient]);
}
