/**
 * Which reminders the phone should have scheduled right now, worked out from the jobs,
 * invoices, renewals and the tradie's reminder switches. Pure, so it can be tested; the
 * notifications module turns the plan into scheduled notifications (lib/notifications.ts).
 */
import type { BusinessSettings, Customer, Invoice, Job, Renewal } from './store';
import { reminderPrefs } from './reminders';
import { jobFacts, QUOTE_NUDGE_DAYS } from './jobSteps';

export interface PlannedNudge {
  id: string;
  at: Date;
  title: string;
  body: string;
  jobId?: string;
  kind: 'quote' | 'invoice' | 'renewal';
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Reminders arrive at 9am, not the middle of the night. */
const at9 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0, 0);
const RENEWAL_DAYS_BEFORE = [30, 7, 0];

export function planNudges(
  input: {
    jobs: Job[];
    invoices: Invoice[];
    customers: Customer[];
    renewals: Renewal[];
    settings: Pick<BusinessSettings, 'reminders' | 'paymentTermsDays'>;
    nameOf: (job: Job) => string;
    money: (n: number) => string;
  },
  now: Date = new Date(),
): PlannedNudge[] {
  const prefs = reminderPrefs(input.settings);
  const firstName = (id: string) =>
    input.customers
      .find((c) => c.id === id)
      ?.name.trim()
      .split(/\s+/)[0] || 'the customer';
  const invoiceFor = new Map(input.invoices.map((i) => [i.jobId, i]));
  const out: PlannedNudge[] = [];

  if (prefs.quoteNoReply) {
    for (const job of input.jobs) {
      const f = jobFacts(job, invoiceFor.get(job.id));
      // Only a sent quote still waiting for a yes (not offered times, not booked, not lost).
      if (!f.quoteSent || f.accepted || f.offered || f.lost || f.done || f.invoiced) continue;
      const last = [job.quoteSentAt!, ...(job.quoteRemindedAt ?? [])].reduce((a, b) => (b > a ? b : a));
      const when = at9(new Date(new Date(last).getTime() + QUOTE_NUDGE_DAYS * DAY_MS));
      if (when <= now) continue;
      out.push({
        id: `nudge-quote-${job.id}`,
        kind: 'quote',
        at: when,
        jobId: job.id,
        title: `No reply from ${firstName(job.customerId)} yet`,
        body: `Your quote for the ${input.nameOf(job).toLowerCase()} went ${QUOTE_NUDGE_DAYS} days ago. Tap to send a reminder.`,
      });
    }
  }

  if (prefs.invoiceOverdue) {
    const terms = input.settings.paymentTermsDays ?? 14;
    for (const inv of input.invoices) {
      if (inv.status !== 'sent' || !inv.sentAt) continue;
      const job = input.jobs.find((j) => j.id === inv.jobId);
      if (job?.lostAt) continue;
      // The morning after the due date.
      const when = at9(new Date(new Date(inv.sentAt).getTime() + (terms + 1) * DAY_MS));
      if (when <= now) continue;
      const number = inv.number ? `INV-${String(inv.number).padStart(4, '0')}` : 'The invoice';
      out.push({
        id: `nudge-invoice-${inv.id}`,
        kind: 'invoice',
        at: when,
        jobId: inv.jobId,
        title: `${firstName(inv.customerId)}’s invoice is overdue`,
        body: `${number} for ${input.money(inv.quote.total)} was due yesterday. Tap to chase it.`,
      });
    }
  }

  if (prefs.renewals) {
    for (const r of input.renewals) {
      const [y, m, d] = r.expires.split('-').map(Number);
      for (const before of RENEWAL_DAYS_BEFORE) {
        const when = new Date(y, m - 1, d - before, 9, 0, 0);
        if (when <= now) continue;
        out.push({
          id: `renewal-${r.id}-${before}`,
          kind: 'renewal',
          at: when,
          title: before === 0 ? `${r.name} expires today` : `${r.name} expires in ${before} days`,
          body: 'Renew it so you stay covered, then update the date in Account.',
        });
      }
    }
  }

  // iOS keeps 64 pending notifications; leave room for job and daily reminders.
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, 50);
}
