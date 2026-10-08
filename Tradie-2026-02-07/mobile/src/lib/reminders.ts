/**
 * Which reminders the tradie wants (Account → Reminders). Unset means on. Kept apart from the
 * store so planning code can be tested on its own.
 */
import type { BusinessSettings } from './store';

export interface ReminderPrefs {
  /** A quote with no reply after a few days. */
  quoteNoReply: boolean;
  /** An invoice past its due date. */
  invoiceOverdue: boolean;
  /** The evening before a booked job. */
  jobTomorrow: boolean;
  /** Insurance or a licence running out. */
  renewals: boolean;
}

export const DEFAULT_REMINDERS: ReminderPrefs = { quoteNoReply: true, invoiceOverdue: true, jobTomorrow: true, renewals: true };

/** The tradie's reminder choices, with anything they haven't set left on. */
export const reminderPrefs = (settings: Pick<BusinessSettings, 'reminders'>): ReminderPrefs => ({
  ...DEFAULT_REMINDERS,
  ...settings.reminders,
});
