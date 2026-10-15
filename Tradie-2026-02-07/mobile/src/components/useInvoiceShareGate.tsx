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
  const { invoicesLeft, confirmPro } = useProAccess();
  const recordInvoiceShared = useTradeStore((s) => s.recordInvoiceShared);
  const [limit, setLimit] = useState(false);

  /**
   * Already counted, a receipt, a free invoice left this month, or Pro (waiting for RevenueCat
   * if it hasn't answered yet). Otherwise shows the Pro prompt.
   */
  const checkShare = async (invoice: Pick<Invoice, 'status' | 'sharedAt' | 'sentAt'>): Promise<boolean> => {
    if (invoice.status === 'paid' || invoice.sharedAt || invoice.sentAt || invoicesLeft > 0 || (await confirmPro())) return true;
    setLimit(true);
    return false;
  };

  /**
   * Shares the invoice if the plan allows, and counts it. iOS doesn't say whether the share
   * sheet was used or cancelled, so opening it is what counts.
   */
  const shareInvoice = async (invoice: Invoice, share: () => Promise<unknown>): Promise<boolean> => {
    if (!(await checkShare(invoice))) return false;
    await share();
    if (invoice.status !== 'paid') recordInvoiceShared(invoice.id);
    return true;
  };

  const limitPrompt = <UpgradePrompt visible={limit} onClose={() => setLimit(false)} feature="invoices" />;
  return { checkShare, shareInvoice, limitPrompt };
}
