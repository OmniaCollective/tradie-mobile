/**
 * Where a job is, in a tradie's words ("Quote sent 2 days ago · waiting for Sarah"), shared
 * by Home, the job and search so they always say the same thing.
 */
import { getRegion, type Invoice, type Job } from './store';
import type { JobPosition } from './jobSteps';
import { formatTime, parseDate, toDateKey } from './dates';

const DAY_MS = 24 * 60 * 60 * 1000;

export function ago(iso: string, now: number = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** Today, Tomorrow, or "Fri 9 Oct". */
export function dayLabel(dateKey: string, now: Date = new Date()): string {
  if (dateKey === toDateKey(now)) return 'Today';
  if (dateKey === toDateKey(new Date(now.getTime() + DAY_MS))) return 'Tomorrow';
  return parseDate(dateKey).toLocaleDateString(getRegion().locale, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Days left to pay a sent invoice (0 once it's due). */
export function daysToPay(invoice: Pick<Invoice, 'sentAt'>, terms: number, now: Date = new Date()): number {
  if (!invoice.sentAt) return terms;
  return Math.max(0, terms - Math.floor((now.getTime() - new Date(invoice.sentAt).getTime()) / DAY_MS));
}

export function whereText(
  job: Job,
  invoice: Invoice | undefined,
  p: JobPosition,
  firstName: string,
  terms: number,
  now: Date = new Date(),
): string {
  switch (p.group) {
    case 'send':
      return 'Quote not sent yet';
    case 'waiting':
      return p.facts.offered
        ? `Times offered · waiting for ${firstName}`
        : `Quote sent ${ago(job.quoteSentAt!, now.getTime())} · waiting for ${firstName}`;
    case 'tobook':
      return 'Said yes · needs a time';
    case 'booked':
      return `${dayLabel(job.scheduledDate!, now)} · ${formatTime(job.scheduledTime)}`;
    case 'invoice':
      return 'Done · ready to invoice';
    case 'unpaid': {
      if (p.overdueDays > 0) return `Invoice ${p.overdueDays} ${p.overdueDays === 1 ? 'day' : 'days'} overdue`;
      const left = daysToPay(invoice!, terms, now);
      return `Invoiced ${ago(invoice!.sentAt!, now.getTime())} · due in ${left} ${left === 1 ? 'day' : 'days'}`;
    }
    case 'paid':
      return invoice?.paidAt ? `Paid ${ago(invoice.paidAt, now.getTime())}` : 'Paid';
    case 'lost':
      return 'Didn’t go ahead';
  }
}
