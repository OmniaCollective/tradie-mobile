/**
 * Where a job is, worked out from what has happened to it (quote sent, times
 * offered, booked, done, invoiced, paid, didn't go ahead) rather than from one
 * status, so the steps can happen in any order: agreed on the phone with no
 * quote, paid cash on the day with no invoice, and so on. Screens read jobs
 * through this. Kept free of React and storage so it can be tested on its own.
 */
import type { Invoice, Job, JobStatus } from './store';

/** The job's checklist, in the order a job usually goes. */
export type StepKey = 'quote' | 'book' | 'done' | 'invoice' | 'paid';
export const STEP_ORDER: readonly StepKey[] = ['quote', 'book', 'done', 'invoice', 'paid'];

/** The Home group a job sits in. */
export type JobGroup = 'send' | 'waiting' | 'tobook' | 'booked' | 'invoice' | 'unpaid' | 'paid' | 'lost';
export const GROUP_ORDER: readonly JobGroup[] = ['send', 'waiting', 'tobook', 'booked', 'invoice', 'unpaid', 'paid', 'lost'];
export const GROUP_TITLES: Record<JobGroup, string> = {
  send: 'Quotes to send',
  waiting: 'Waiting for a yes',
  tobook: 'To book',
  booked: 'Coming up',
  invoice: 'To invoice',
  unpaid: 'Waiting for payment',
  paid: 'Paid',
  lost: 'Didn’t go ahead',
};

/** A quote with no reply for this many days gets a "Remind". */
export const QUOTE_NUDGE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export type JobFactsInput = Pick<
  Job,
  'quoteSentAt' | 'acceptedAt' | 'offeredSlots' | 'scheduledDate' | 'completedAt' | 'lostAt' | 'quoteRemindedAt'
>;
export type InvoiceFactsInput = Pick<Invoice, 'status' | 'sentAt' | 'chasedAt'>;

export interface JobFacts {
  quoteSent: boolean;
  /** Times sent to the customer and not yet booked. */
  offered: boolean;
  /** The customer said yes. Booking counts as yes. */
  accepted: boolean;
  booked: boolean;
  done: boolean;
  /** An invoice exists (sent or not). */
  invoiced: boolean;
  invoiceSent: boolean;
  paid: boolean;
  lost: boolean;
}

export function jobFacts(job: JobFactsInput, invoice?: InvoiceFactsInput): JobFacts {
  const booked = !!job.scheduledDate;
  return {
    quoteSent: !!job.quoteSentAt,
    offered: !booked && !!job.offeredSlots?.length,
    accepted: booked || !!job.acceptedAt,
    booked,
    done: !!job.completedAt,
    invoiced: !!invoice,
    invoiceSent: !!invoice?.sentAt,
    paid: invoice?.status === 'paid',
    lost: !!job.lostAt,
  };
}

/** Whether each checklist step is done. A job agreed without a quote has nothing left to quote. */
export function stepsDone(f: JobFacts): Record<StepKey, boolean> {
  return {
    quote: f.quoteSent || f.accepted,
    book: f.booked,
    done: f.done,
    invoice: f.invoiceSent,
    paid: f.paid,
  };
}

export interface JobPosition {
  facts: JobFacts;
  group: JobGroup;
  /** The step to highlight: the first after the furthest reached; null once paid or lost. Only a suggestion. */
  next: StepKey | null;
  /** Whole days past the invoice due date (0 if not overdue). */
  overdueDays: number;
  /** Days since the quote was sent or last reminded, while waiting for a yes (0 otherwise). */
  quoteWaitingDays: number;
  /** What the Home row offers: Remind a quiet quote, Chase an overdue invoice. */
  nudge: 'remind' | 'chase' | null;
  /** Chase wording: the first nudge is polite, later ones firmer. */
  chaseIsFollowUp: boolean;
}

export function jobPosition(
  job: JobFactsInput,
  invoice: (InvoiceFactsInput & Pick<Invoice, 'sentAt'>) | undefined,
  paymentTermsDays: number,
  now: Date = new Date(),
): JobPosition {
  const f = jobFacts(job, invoice);

  const group: JobGroup = f.lost
    ? 'lost'
    : f.paid
      ? 'paid'
      : f.invoiceSent
        ? 'unpaid'
        : f.done || f.invoiced
          ? 'invoice'
          : f.booked
            ? 'booked'
            : f.offered
              ? 'waiting'
              : f.accepted
                ? 'tobook'
                : f.quoteSent
                  ? 'waiting'
                  : 'send';

  // Suggest the first step after the furthest one reached: a finished job that was never quoted
  // suggests the invoice, not the quote.
  const done = stepsDone(f);
  const furthest = STEP_ORDER.reduce((last, k, i) => (done[k] ? i : last), -1);
  const next = f.lost || f.paid ? null : (STEP_ORDER.slice(furthest + 1).find((k) => !done[k]) ?? null);

  let overdueDays = 0;
  if (f.invoiceSent && !f.paid && invoice?.sentAt) {
    const due = new Date(invoice.sentAt).getTime() + (paymentTermsDays ?? 14) * DAY_MS;
    overdueDays = Math.max(0, Math.floor((now.getTime() - due) / DAY_MS));
  }

  let quoteWaitingDays = 0;
  if (group === 'waiting' && !f.offered && job.quoteSentAt) {
    const last = [job.quoteSentAt, ...(job.quoteRemindedAt ?? [])].reduce((a, b) => (b > a ? b : a));
    quoteWaitingDays = Math.max(0, Math.floor((now.getTime() - new Date(last).getTime()) / DAY_MS));
  }

  const nudge = overdueDays > 0 ? 'chase' : quoteWaitingDays >= QUOTE_NUDGE_DAYS ? 'remind' : null;

  return { facts: f, group, next, overdueDays, quoteWaitingDays, nudge, chaseIsFollowUp: (invoice?.chasedAt?.length ?? 0) > 0 };
}

/**
 * The old single status, kept in step while screens move over to jobPosition.
 * A job that didn't go ahead keeps whatever it had.
 */
export function legacyStatus(f: JobFacts, current: JobStatus): JobStatus {
  if (f.lost) return current;
  if (f.paid) return 'PAID';
  if (f.invoiced) return 'INVOICED';
  if (f.done) return 'COMPLETED';
  if (f.booked) return 'SCHEDULED';
  if (f.accepted) return 'APPROVED';
  if (f.quoteSent) return 'QUOTED';
  return 'REQUESTED';
}
