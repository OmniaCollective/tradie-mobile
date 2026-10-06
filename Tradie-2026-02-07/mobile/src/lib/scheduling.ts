/**
 * "Suggest times": finds the best free times for a new job.
 *
 * Pure logic (no React Native imports) so it can be tested on its own. The
 * caller gathers the diary (booked jobs, pencilled-in offers, iPhone calendar)
 * and drive times; this decides which times are possible and ranks them.
 *
 * The app only suggests. Nothing is booked until the tradie confirms.
 */

export interface BusyBlock {
  start: Date;
  end: Date;
  /** Postcode of a job, so drive time to/from it can be counted. */
  postcode?: string;
  /** Shown in reasons, e.g. "your 9:00 job in SE1". */
  kind: 'job' | 'offer' | 'calendar';
}

export interface SuggestInput {
  /** Days start counting from tomorrow: no same-day surprises. */
  now: Date;
  /** "08:00" */
  workStart: string;
  /** "18:00" */
  workEnd: string;
  /** 0 = Sunday … 6 = Saturday */
  workingDays: number[];
  durationMinutes: number;
  busy: BusyBlock[];
  /** Driving minutes from the new customer to a postcode; null if unknown. */
  driveFrom: (postcode: string) => number | null;
  /** Tradie's base postcode, for the first job of a day. */
  basePostcode?: string;
  /** Used when a drive time is unknown (no postcode, offline). */
  fallbackDriveMinutes?: number;
  horizonDays?: number;
  stepMinutes?: number;
  count?: number;
}

export interface Suggestion {
  start: Date;
  end: Date;
  /** Plain-English reason, e.g. "After your 9:00 job in SE1 · 12 min drive". */
  reason: string;
  /** True when it slots in near other work that day. */
  fitsRoute: boolean;
  score: number;
}

const MINUTE = 60_000;
const NEARBY_MINUTES = 20;

function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10) || 0);
  const d = new Date(day);
  d.setHours(h, m, 0, 0);
  return d;
}

const hhmm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
const area = (postcode?: string) => (postcode ? postcode.trim().toUpperCase().split(/\s+/)[0] : undefined);

/** All possible times, best first (one entry per candidate start). */
export function rankTimes(input: SuggestInput): Suggestion[] {
  const {
    now,
    workStart,
    workEnd,
    workingDays,
    durationMinutes,
    busy,
    driveFrom,
    basePostcode,
    fallbackDriveMinutes = 30,
    horizonDays = 28,
    stepMinutes = 30,
  } = input;

  const drive = (postcode?: string) => {
    const known = postcode ? driveFrom(postcode) : null;
    return known ?? fallbackDriveMinutes;
  };
  const baseDrive = basePostcode ? driveFrom(basePostcode) : null;

  const results: Suggestion[] = [];

  for (let offset = 1; offset <= horizonDays; offset++) {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() + offset);
    if (!workingDays.includes(day.getDay())) continue;

    const dayStart = atTime(day, workStart);
    const dayEnd = atTime(day, workEnd);
    const dayBusy = busy
      .filter((b) => b.end > dayStart && b.start < dayEnd)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const dayJobs = dayBusy.filter((b) => b.kind !== 'calendar' && b.postcode);
    const nearestJobToday = dayJobs.reduce<number | null>((min, b) => {
      const m = driveFrom(b.postcode!);
      return m === null ? min : min === null ? m : Math.min(min, m);
    }, null);

    for (let t = dayStart.getTime(); t + durationMinutes * MINUTE <= dayEnd.getTime(); t += stepMinutes * MINUTE) {
      const start = new Date(t);
      const end = new Date(t + durationMinutes * MINUTE);

      if (dayBusy.some((b) => b.start < end && b.end > start)) continue;

      const prev = [...dayBusy].reverse().find((b) => b.end <= start);
      const next = dayBusy.find((b) => b.start >= end);

      // Personal calendar events have no location: just leave a short gap.
      const before = prev ? (prev.kind === 'calendar' ? 15 : drive(prev.postcode)) : 0;
      const after = next ? (next.kind === 'calendar' ? 15 : drive(next.postcode)) : 0;
      if (prev && start.getTime() < prev.end.getTime() + before * MINUTE) continue;
      if (next && end.getTime() + after * MINUTE > next.start.getTime()) continue;

      // Lower is better.
      const driving = (prev ? before : baseDrive ?? fallbackDriveMinutes / 2) + (next ? after : 0);
      const idleBefore = prev ? (start.getTime() - prev.end.getTime()) / MINUTE - before : 0;
      const fitsRoute = nearestJobToday !== null && nearestJobToday <= NEARBY_MINUTES;
      const score = driving + Math.min(idleBefore, 240) * 0.1 + offset * 1.5 - (fitsRoute ? 25 : 0);

      let reason: string;
      if (prev && prev.kind !== 'calendar') {
        reason = `After your ${hhmm(prev.start)} job${area(prev.postcode) ? ` in ${area(prev.postcode)}` : ''} · ${before} min drive`;
      } else if (next && next.kind !== 'calendar') {
        reason = `Before your ${hhmm(next.start)} job${area(next.postcode) ? ` in ${area(next.postcode)}` : ''} · ${after} min drive`;
      } else if (dayBusy.length === 0) {
        reason = baseDrive !== null ? `Free day · ${baseDrive} min from your base` : 'Free day';
      } else {
        reason = 'Free around your other plans';
      }

      results.push({ start, end, reason, fitsRoute, score });
    }
  }

  return results.sort((a, b) => a.score - b.score || a.start.getTime() - b.start.getTime());
}

const band = (d: Date) => (d.getHours() < 11 ? 0 : d.getHours() < 14 ? 1 : 2);

/**
 * The best few times, on different days, in date order. A small penalty for
 * repeating a time of day (morning / midday / afternoon) gives customers a real
 * choice when the times are otherwise similarly good.
 */
export function suggestTimes(input: SuggestInput): Suggestion[] {
  const count = input.count ?? 3;
  const ranked = rankTimes(input);
  const picked: Suggestion[] = [];
  const days = new Set<string>();
  const bands = [0, 0, 0];

  while (picked.length < count) {
    let best: Suggestion | null = null;
    let bestScore = Infinity;
    for (const s of ranked) {
      if (days.has(s.start.toDateString())) continue;
      const effective = s.score + bands[band(s.start)] * 8;
      if (effective < bestScore) {
        best = s;
        bestScore = effective;
      }
    }
    if (!best) break;
    picked.push(best);
    days.add(best.start.toDateString());
    bands[band(best.start)]++;
  }

  return picked.sort((a, b) => a.start.getTime() - b.start.getTime());
}
