/**
 * Local reminders scheduled on the phone. There is no push server, so nothing
 * here registers for remote notifications. Permission is asked for the first
 * time a reminder is set up, not at launch.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show reminders even when Tradie is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData extends Record<string, unknown> {
  type: 'job_reminder' | 'daily_reminder' | 'renewal';
  jobId?: string;
}

const DAILY_REMINDER_ID = 'daily-reminder';
const jobReminderId = (jobId: string) => `job-reminder-${jobId}`;

/** Asks for permission if it hasn't been decided yet. Returns whether reminders can be shown. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
  if (granted && Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
  return granted;
}

/**
 * Reminder an hour before a booked job. Each job has one reminder: booking it
 * again replaces the old one rather than adding a second.
 */
export async function scheduleJobReminder(jobId: string, customerName: string, jobType: string, start: Date): Promise<void> {
  const at = new Date(start.getTime() - 60 * 60 * 1000);
  await Notifications.cancelScheduledNotificationAsync(jobReminderId(jobId)).catch(() => {});
  if (at <= new Date() || !(await ensureNotificationPermission())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: jobReminderId(jobId),
    content: {
      title: 'Job in 1 hour',
      body: `${jobType} for ${customerName}`,
      data: { type: 'job_reminder', jobId } satisfies NotificationData,
      sound: 'default',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
  });
}

/** Removes a job's reminder, e.g. when the job is deleted. */
export async function cancelJobReminder(jobId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(jobReminderId(jobId)).catch(() => {});
}

const RENEWAL_DAYS_BEFORE = [30, 7, 0];
const renewalReminderId = (id: string, daysBefore: number) => `renewal-${id}-${daysBefore}`;

/** Removes a renewal's reminders (on delete, or before rescheduling after an edit). */
export async function cancelRenewalReminders(renewalId: string): Promise<void> {
  await Promise.all(
    RENEWAL_DAYS_BEFORE.map((d) => Notifications.cancelScheduledNotificationAsync(renewalReminderId(renewalId, d)).catch(() => {})),
  );
}

/** Reminders at 9am, 30 and 7 days before a renewal's expiry and on the day itself. */
export async function scheduleRenewalReminders(renewal: { id: string; name: string; expires: string }): Promise<void> {
  await cancelRenewalReminders(renewal.id);
  const [y, m, d] = renewal.expires.split('-').map(Number);
  const now = new Date();
  const upcoming = RENEWAL_DAYS_BEFORE.map((before) => ({ before, at: new Date(y, m - 1, d - before, 9, 0, 0) })).filter(
    ({ at }) => at > now,
  );
  if (upcoming.length === 0 || !(await ensureNotificationPermission())) return;
  for (const { before, at } of upcoming) {
    await Notifications.scheduleNotificationAsync({
      identifier: renewalReminderId(renewal.id, before),
      content: {
        title: before === 0 ? `${renewal.name} expires today` : `${renewal.name} expires in ${before} days`,
        body: 'Renew it so you stay covered. Update the new date in Account.',
        data: { type: 'renewal' } satisfies NotificationData,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
    });
  }
}

/** Removes every scheduled reminder (used when all data is deleted). */
export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
}

/** Whether the 6pm "message tomorrow's customers" nudge is on. */
export async function isDailyReminderOn(): Promise<boolean> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.some((n) => n.identifier === DAILY_REMINDER_ID);
  } catch {
    return false; // not available (web preview)
  }
}

/** Turns the 6pm nudge on or off. Returns the resulting state (off if permission was refused). */
export async function setDailyReminder(on: boolean): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID).catch(() => {});
  if (!on || !(await ensureNotificationPermission())) return false;
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'Tomorrow’s jobs',
      body: 'Check tomorrow’s jobs and text your customers a reminder.',
      data: { type: 'daily_reminder' } satisfies NotificationData,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 18, minute: 0 },
  });
  return true;
}

export function addNotificationResponseListener(callback: (response: Notifications.NotificationResponse) => void) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
