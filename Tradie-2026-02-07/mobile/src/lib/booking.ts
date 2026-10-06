/**
 * Booking a job at a time, and gathering everything "Suggest times" needs.
 * Both the date picker and "book an offered time" go through scheduleJob, so
 * confirmations, reminders and calendar sync always behave the same.
 */
import { useTradeStore, OFFER_HOLD_HOURS, type Job, type Customer, type OfferedSlot, getRegion } from './store';
import { getJobTypeLabel } from './store';
import { scheduleJobReminder, sendBookingConfirmedNotification } from './notifications';
import { syncJobToCalendar, hasCalendarPermissions, getBusyCalendarTimes } from './calendarSync';
import { suggestTimes, rankTimes, type BusyBlock, type Suggestion } from './scheduling';
import { apiPost, getSessionToken } from './api';
import { parseDate, toDateKey } from './dates';

const HOUR = 3_600_000;
const HORIZON_DAYS = 28;

export function slotDate({ date, time }: OfferedSlot): Date {
  const d = parseDate(date);
  const [h, m] = time.split(':').map((n) => parseInt(n, 10) || 0);
  d.setHours(h, m, 0, 0);
  return d;
}

/** "Thu 8 Oct, 9:30am" — the wording customers see in texts. */
export function formatSlot(d: Date): string {
  const day = d.toLocaleDateString(getRegion().locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const h = d.getHours();
  const time = `${h % 12 || 12}${d.getMinutes() ? `:${String(d.getMinutes()).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
  return `${day}, ${time}`;
}

export function toSlot(d: Date): OfferedSlot {
  return { date: toDateKey(d), time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
}

/** Offered times still pencilled in (sent within the hold period, job not yet booked). */
export function activeOffer(job: Pick<Job, 'offeredSlots' | 'offeredAt' | 'scheduledDate'>, now = Date.now()): OfferedSlot[] {
  if (!job.offeredSlots?.length || !job.offeredAt || job.scheduledDate) return [];
  if (now - new Date(job.offeredAt).getTime() > OFFER_HOLD_HOURS * HOUR) return [];
  return job.offeredSlots;
}

export function offerExpired(job: Pick<Job, 'offeredSlots' | 'offeredAt' | 'scheduledDate'>, now = Date.now()): boolean {
  return !!job.offeredSlots?.length && !!job.offeredAt && !job.scheduledDate && activeOffer(job, now).length === 0;
}

/** Books the job, clears any pencilled-in times, notifies, reminds and syncs to the calendar. */
export async function scheduleJob(job: Job, customer: Customer, when: Date): Promise<void> {
  const { date, time } = toSlot(when);
  const store = useTradeStore.getState();
  store.updateJob(job.id, { status: 'SCHEDULED', scheduledDate: date, scheduledTime: time, offeredSlots: undefined, offeredAt: undefined });

  // The job is booked above; each follow-up is independent, so one failing
  // (notifications off, calendar unavailable) never undoes or blocks the others.
  const label = getJobTypeLabel(store.settings.trade, job.type);
  const attempt = async (what: string, run: () => Promise<unknown>) => {
    try {
      await run();
    } catch (error) {
      if (__DEV__) console.warn(`[Booking] ${what} failed:`, error);
    }
  };
  await attempt('confirmation notification', () => sendBookingConfirmedNotification(customer.name, date, time));
  await attempt('job reminder', () => scheduleJobReminder(job.id, customer.name, label, when, time));
  await attempt('calendar sync', async () => {
    if (await hasCalendarPermissions()) {
      await syncJobToCalendar({ ...job, status: 'SCHEDULED', scheduledDate: date, scheduledTime: time }, customer, label);
    }
  });
}

export type TravelNote = 'apple' | 'estimate' | 'signed-out' | 'no-postcode' | 'postcode-not-found' | 'offline';

export interface SuggestResult {
  suggestions: Suggestion[];
  /** Every possible time, best first, for "More times". */
  alternatives: Suggestion[];
  durationMinutes: number;
  travel: TravelNote;
}

/** Gathers the diary and drive times, then asks the engine for the best times. */
export async function buildSuggestions(jobId: string, now = new Date()): Promise<SuggestResult> {
  const { jobs, customers, settings, pricingPresets } = useTradeStore.getState();
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error('Job not found');
  const customer = customers.find((c) => c.id === job.customerId);

  const minutesFor = (j: Job) =>
    Math.max(30, Math.round((pricingPresets.find((p) => p.type === j.type)?.estimatedHours ?? 1) * 60));
  const postcodeFor = (j: Job) => customers.find((c) => c.id === j.customerId)?.postcode?.trim() || undefined;
  const horizonEnd = new Date(now.getTime() + (HORIZON_DAYS + 1) * 24 * HOUR);

  // Booked jobs and times pencilled in for other customers.
  const busy: BusyBlock[] = [];
  for (const other of jobs) {
    if (other.id === job.id) continue;
    if ((other.status === 'SCHEDULED' || other.status === 'IN_PROGRESS') && other.scheduledDate) {
      const start = slotDate({ date: other.scheduledDate, time: other.scheduledTime || settings.workingHours.start });
      if (start < now || start > horizonEnd) continue;
      busy.push({ start, end: new Date(start.getTime() + minutesFor(other) * 60_000), postcode: postcodeFor(other), kind: 'job' });
    }
    for (const slot of activeOffer(other, now.getTime())) {
      const start = slotDate(slot);
      busy.push({ start, end: new Date(start.getTime() + minutesFor(other) * 60_000), postcode: postcodeFor(other), kind: 'offer' });
    }
  }
  for (const b of await getBusyCalendarTimes(now, horizonEnd)) busy.push({ ...b, kind: 'calendar' });

  // Drive times from the customer to the base and to each job's postcode.
  const origin = customer?.postcode?.trim();
  const places = [...new Set([settings.postcode?.trim(), ...busy.map((b) => b.postcode)].filter((p): p is string => !!p))];
  const minutesByPlace = new Map<string, number | null>();
  let travel: TravelNote = 'estimate';
  if (!origin) {
    travel = 'no-postcode';
  } else if (!(await getSessionToken())) {
    travel = 'signed-out';
  } else if (places.length > 0) {
    try {
      const result = await apiPost<{ minutes: (number | null)[]; found: boolean; source: 'apple' | 'estimate' }>(
        '/api/travel/times',
        { origin, places: places.slice(0, 40) },
      );
      travel = result.found ? result.source : 'postcode-not-found';
      places.forEach((p, i) => minutesByPlace.set(p.toUpperCase(), result.minutes[i] ?? null));
    } catch {
      travel = 'offline';
    }
  } else {
    travel = 'apple';
  }

  const input = {
    now,
    workStart: settings.workingHours.start || '08:00',
    workEnd: settings.workingHours.end || '18:00',
    workingDays: settings.workingDays?.length ? settings.workingDays : [1, 2, 3, 4, 5],
    durationMinutes: minutesFor(job),
    busy,
    driveFrom: (p: string) => minutesByPlace.get(p.trim().toUpperCase()) ?? null,
    basePostcode: settings.postcode?.trim() || undefined,
    horizonDays: HORIZON_DAYS,
  };

  return {
    suggestions: suggestTimes(input),
    alternatives: rankTimes(input).slice(0, 40),
    durationMinutes: input.durationMinutes,
    travel,
  };
}

/** The text that offers the times, e.g. "1) Thu 8 Oct, 9:30am". */
export function offerMessage(customer: Customer, jobLabel: string, times: Date[]): string {
  const { settings } = useTradeStore.getState();
  const first = customer.name.trim().split(/\s+/)[0];
  const me = settings.ownerName?.trim().split(/\s+/)[0];
  const business = settings.businessName && settings.businessName !== 'TRADIE' ? settings.businessName : '';
  const from = me && business ? `it's ${me} from ${business}` : me ? `it's ${me}` : business ? `it's ${business}` : '';
  const choices = times.map((t, i) => `${i + 1}) ${formatSlot(t)}`).join('\n');
  const reply = times.length === 1 ? 'Just reply yes' : `Just reply ${times.map((_, i) => i + 1).join(times.length === 2 ? ' or ' : ', ').replace(/, (\d)$/, ' or $1')}`;
  return `Hi ${first}${from ? `, ${from}` : ''}. I can come for your ${jobLabel.toLowerCase()}:\n${choices}\n${reply} and I'll confirm.`;
}

/** The confirmation text once a time is booked. */
export function confirmationMessage(customer: Customer, when: Date): string {
  const { settings } = useTradeStore.getState();
  const first = customer.name.trim().split(/\s+/)[0];
  const sign = settings.ownerName?.trim().split(/\s+/)[0] || settings.businessName || '';
  return `Thanks ${first}, you're booked in for ${formatSlot(when)}. See you then${sign ? ` — ${sign}` : ''}.`;
}
