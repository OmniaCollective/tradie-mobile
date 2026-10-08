/**
 * Chasing payment on a sent invoice: a pre-written text the tradie sends from
 * their own phone. Friendly before the due date, polite on the first chase once
 * overdue, firmer after that. The invoice PDF is attached where Messages allows.
 */
import { Platform, Share } from 'react-native';
import * as SMS from 'expo-sms';
import {
  useTradeStore,
  businessDisplayName,
  invoiceNumberLabel,
  invoiceDueDate,
  daysOverdue,
  type Invoice,
  type Customer,
  type Job,
  type BusinessSettings,
} from './store';
import { formatMoney } from './money';
import { formatDateObj } from './dates';
import { createInvoicePdf } from './invoiceExport';

/** What the customer still owes: the total less any CIS the contractor holds back. */
const owed = (invoice: Invoice) => invoice.quote.total - (invoice.cisDeducted ? (invoice.cisDeductionAmount ?? 0) : 0);

export function chaseMessage(invoice: Invoice, customer: Customer, settings: BusinessSettings, now = new Date()): string {
  const first = customer.name.trim().split(/\s+/)[0] || customer.name;
  const ref = invoiceNumberLabel(invoice);
  const amount = formatMoney(owed(invoice));
  const due = invoiceDueDate(invoice, settings);
  const late = daysOverdue(invoice, settings, now);
  const chasedBefore = (invoice.chasedAt?.length ?? 0) > 0;
  const details = settings.paymentDetails
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .join('\n');
  const pay = details ? `\n\nTo pay:\n${details}\nReference: ${ref}` : '';
  const sign = `\n\nThanks,\n${settings.ownerName.trim().split(/\s+/)[0] || businessDisplayName(settings)}`;

  if (late === 0) {
    const when = due ? ` on ${formatDateObj(due)}` : ' soon';
    return `Hi ${first}, a friendly reminder that invoice ${ref} for ${amount} is due${when}.${pay}${sign}`;
  }
  // Agreed wording: polite the first time, firmer after that.
  const howToPay = pay || '\n\nPayment details are on the invoice.';
  if (!chasedBefore) {
    return `Hi ${first}, a quick reminder that invoice ${ref} for ${amount} was due on ${formatDateObj(due!)}.${howToPay}${sign}`;
  }
  return `Hi ${first}, invoice ${ref} for ${amount} is now ${late} ${late === 1 ? 'day' : 'days'} overdue. Could you settle it this week please?${pay}${sign}`;
}

/**
 * Opens the reminder in Messages (with the invoice PDF attached) or, without a
 * phone number, the share sheet. Records the chase if it was sent.
 */
export async function chaseInvoice(invoice: Invoice, job: Job, customer: Customer, settings: BusinessSettings): Promise<boolean> {
  const message = chaseMessage(invoice, customer, settings);
  let sent = false;
  if (customer.phone?.trim() && Platform.OS !== 'web' && (await SMS.isAvailableAsync())) {
    let attachments: SMS.SMSAttachment[] | undefined;
    try {
      const uri = await createInvoicePdf({ invoice, job, customer, settings });
      attachments = [{ uri, mimeType: 'application/pdf', filename: `${invoiceNumberLabel(invoice)}.pdf` }];
    } catch {
      attachments = undefined; // the text still goes, just without the PDF
    }
    const { result } = await SMS.sendSMSAsync([customer.phone], message, attachments ? { attachments } : undefined);
    sent = result !== 'cancelled';
  } else {
    const r = await Share.share({ message });
    sent = r.action !== Share.dismissedAction;
  }
  if (sent) {
    const fresh = useTradeStore.getState().invoices.find((i) => i.id === invoice.id);
    useTradeStore.getState().updateInvoice(invoice.id, { chasedAt: [...(fresh?.chasedAt ?? []), new Date().toISOString()] });
  }
  return sent;
}

/** "Remind" on a quote with no reply (the agreed friendly wording, editable before it's sent). */
export function quoteReminderMessage(job: Job, customer: Customer, jobLabel: string, settings: BusinessSettings): string {
  const first = customer.name.trim().split(/\s+/)[0] || customer.name;
  const amount = job.quote ? ` (${formatMoney(job.quote.total)})` : '';
  const me = settings.ownerName.trim().split(/\s+/)[0];
  const business = settings.businessName.trim();
  const sign = [me, business].filter(Boolean).join(', ') || businessDisplayName(settings);
  return `Hi ${first}, just checking you got my quote for the ${jobLabel.toLowerCase()}${amount}. Happy to answer any questions. ${sign}`;
}

/** Opens the quote reminder in Messages (or the share sheet) and records it if it was sent. */
export async function remindAboutQuote(
  job: Job,
  customer: Customer,
  jobLabel: string,
  settings: BusinessSettings,
): Promise<boolean> {
  const message = quoteReminderMessage(job, customer, jobLabel, settings);
  let sent = false;
  if (customer.phone?.trim() && Platform.OS !== 'web' && (await SMS.isAvailableAsync())) {
    const { result } = await SMS.sendSMSAsync([customer.phone], message);
    sent = result !== 'cancelled';
  } else {
    const r = await Share.share({ message });
    sent = r.action !== Share.dismissedAction;
  }
  if (sent) useTradeStore.getState().recordQuoteReminder(job.id);
  return sent;
}
