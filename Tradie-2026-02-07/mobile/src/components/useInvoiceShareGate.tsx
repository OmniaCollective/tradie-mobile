/**
 * The free plan's 3 invoices a month, checked in one place. An invoice counts the first time
 * its PDF leaves the app, by any route (send, send again, share, chase), whether or not the
 * tradie then says it was sent. Receipts for paid invoices are always free.
 */
import React, { useState } from 'react';
import { useTradeStore, type Invoice } from '@/lib/store';
import { useProAccess } from '@/lib/useProAccess';
import { UpgradePrompt } from '@/components/UpgradePrompt';

export function useInvoiceShareGate() {
  const { isPro, isLoading, invoicesLeft } = useProAccess();
  const recordInvoiceShared = useTradeStore((s) => s.recordInvoiceShared);
  const [limit, setLimit] = useState(false);

  /** Already counted, a receipt, Pro, or a free invoice left this month. */
  const canShare = (invoice: Pick<Invoice, 'status' | 'sharedAt' | 'sentAt'>) =>
    isPro || isLoading || invoice.status === 'paid' || !!(invoice.sharedAt || invoice.sentAt) || invoicesLeft > 0;

  /**
   * Shares the invoice if the plan allows, and counts it. iOS doesn't say whether the share
   * sheet was used or cancelled, so opening it is what counts.
   */
  const shareInvoice = async (invoice: Invoice, share: () => Promise<unknown>): Promise<boolean> => {
    if (!canShare(invoice)) {
      setLimit(true);
      return false;
    }
    await share();
    if (invoice.status !== 'paid') recordInvoiceShared(invoice.id);
    return true;
  };

  const limitPrompt = <UpgradePrompt visible={limit} onClose={() => setLimit(false)} feature="invoices" />;
  return { canShare, shareInvoice, limitPrompt };
}
