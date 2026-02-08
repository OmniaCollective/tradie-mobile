/**
 * Customer Reminders Service
 *
 * Sends automated SMS reminders to customers before their scheduled jobs.
 * Also handles quote expiry follow-ups.
 */

import * as SMS from 'expo-sms';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Job, Customer, BusinessSettings } from './store';

const SENT_REMINDERS_KEY = 'tradie-sent-reminders';
const QUOTE_FOLLOWUPS_KEY = 'tradie-quote-followups';

interface SentReminder {
  jobId: string;
  type: 'day_before' | 'morning_of';
  sentAt: string;
}

interface QuoteFollowup {
  jobId: string;
  sentAt: string;
}

/**
 * Get sent reminders from storage
 */
async function getSentReminders(): Promise<SentReminder[]> {
  try {
    const data = await AsyncStorage.getItem(SENT_REMINDERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save sent reminders to storage
 */
async function saveSentReminders(reminders: SentReminder[]): Promise<void> {
  await AsyncStorage.setItem(SENT_REMINDERS_KEY, JSON.stringify(reminders));
}

/**
 * Get quote followups from storage
 */
async function getQuoteFollowups(): Promise<QuoteFollowup[]> {
  try {
    const data = await AsyncStorage.getItem(QUOTE_FOLLOWUPS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save quote followups to storage
 */
async function saveQuoteFollowups(followups: QuoteFollowup[]): Promise<void> {
  await AsyncStorage.setItem(QUOTE_FOLLOWUPS_KEY, JSON.stringify(followups));
}

/**
 * Format time for display (e.g., "10:00 AM")
 */
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Format date for display (e.g., "Monday, 15 January")
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Send SMS reminder to customer (opens SMS app with pre-filled message)
 */
export async function sendCustomerReminder(
  customer: Customer,
  job: Job,
  jobTypeLabel: string,
  businessName: string,
  reminderType: 'day_before' | 'morning_of'
): Promise<boolean> {
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) {
    console.log('[Reminders] SMS not available');
    return false;
  }

  // Check if reminder was already sent
  const sentReminders = await getSentReminders();
  const alreadySent = sentReminders.some(
    (r) => r.jobId === job.id && r.type === reminderType
  );

  if (alreadySent) {
    console.log('[Reminders] Reminder already sent for job:', job.id);
    return false;
  }

  const formattedTime = job.scheduledTime ? formatTime(job.scheduledTime) : 'your scheduled time';
  const formattedDate = job.scheduledDate ? formatDate(job.scheduledDate) : 'your scheduled date';

  let message: string;

  if (reminderType === 'day_before') {
    message = `Hi ${customer.name},\n\nJust a reminder that your ${jobTypeLabel.toLowerCase()} appointment is scheduled for tomorrow (${formattedDate}) at ${formattedTime}.\n\nAddress: ${customer.address}, ${customer.postcode}\n\nIf you need to reschedule, please let us know.\n\nSee you tomorrow!\n${businessName}`;
  } else {
    message = `Hi ${customer.name},\n\nYour ${jobTypeLabel.toLowerCase()} appointment is today at ${formattedTime}.\n\nWe're on our way! If you have any questions, give us a call.\n\n${businessName}`;
  }

  try {
    const { result } = await SMS.sendSMSAsync([customer.phone], message);

    if (result === 'sent' || result === 'unknown') {
      // Mark as sent
      const updatedReminders = [
        ...sentReminders,
        { jobId: job.id, type: reminderType, sentAt: new Date().toISOString() },
      ];
      await saveSentReminders(updatedReminders);
      console.log('[Reminders] Sent', reminderType, 'reminder for job:', job.id);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Reminders] Error sending SMS:', error);
    return false;
  }
}

/**
 * Send quote expiry follow-up to customer
 */
export async function sendQuoteFollowup(
  customer: Customer,
  job: Job,
  jobTypeLabel: string,
  businessName: string
): Promise<boolean> {
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) {
    console.log('[Reminders] SMS not available');
    return false;
  }

  // Check if followup was already sent
  const followups = await getQuoteFollowups();
  const alreadySent = followups.some((f) => f.jobId === job.id);

  if (alreadySent) {
    console.log('[Reminders] Quote followup already sent for job:', job.id);
    return false;
  }

  const quoteTotal = job.quote?.total.toFixed(2) || '0.00';

  const message = `Hi ${customer.name},\n\nJust following up on your ${jobTypeLabel.toLowerCase()} quote for £${quoteTotal}.\n\nYour quote is expiring soon. Would you like to go ahead and book?\n\nReply YES to confirm, or let us know if you have any questions.\n\n${businessName}`;

  try {
    const { result } = await SMS.sendSMSAsync([customer.phone], message);

    if (result === 'sent' || result === 'unknown') {
      // Mark as sent
      const updatedFollowups = [
        ...followups,
        { jobId: job.id, sentAt: new Date().toISOString() },
      ];
      await saveQuoteFollowups(updatedFollowups);
      console.log('[Reminders] Sent quote followup for job:', job.id);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Reminders] Error sending quote followup:', error);
    return false;
  }
}

/**
 * Check if a quote is expiring soon (within 24 hours)
 */
export function isQuoteExpiringSoon(job: Job): boolean {
  if (!job.quote?.validUntil) return false;

  const expiryDate = new Date(job.quote.validUntil);
  const now = new Date();
  const hoursUntilExpiry = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  return hoursUntilExpiry > 0 && hoursUntilExpiry <= 24;
}

/**
 * Check if a quote has expired
 */
export function isQuoteExpired(job: Job): boolean {
  if (!job.quote?.validUntil) return false;

  const expiryDate = new Date(job.quote.validUntil);
  return new Date() > expiryDate;
}

/**
 * Get jobs that need day-before reminders sent
 */
export function getJobsNeedingDayBeforeReminder(jobs: Job[]): Job[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  return jobs.filter(
    (job) =>
      job.status === 'SCHEDULED' &&
      job.scheduledDate === tomorrowStr
  );
}

/**
 * Get jobs that need morning-of reminders sent
 */
export function getJobsNeedingMorningReminder(jobs: Job[]): Job[] {
  const today = new Date().toISOString().split('T')[0];

  return jobs.filter(
    (job) =>
      job.status === 'SCHEDULED' &&
      job.scheduledDate === today
  );
}

/**
 * Get quotes that are expiring soon and need followup
 */
export function getQuotesNeedingFollowup(jobs: Job[]): Job[] {
  return jobs.filter(
    (job) =>
      job.status === 'QUOTED' &&
      isQuoteExpiringSoon(job)
  );
}

/**
 * Schedule a local notification to remind tradesperson to send customer reminders
 */
export async function scheduleReminderCheck(): Promise<void> {
  // Schedule for 6 PM every day to check tomorrow's jobs
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(18, 0, 0, 0);

  // If it's past 6 PM, schedule for tomorrow
  if (now > scheduledTime) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Send Customer Reminders',
      body: 'You have jobs scheduled for tomorrow. Send reminders to your customers!',
      data: { type: 'reminder_check' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 18,
      minute: 0,
    },
  });

  console.log('[Reminders] Scheduled daily reminder check');
}

/**
 * Schedule a notification for quote expiry followup
 */
export async function scheduleQuoteExpiryNotification(
  jobId: string,
  customerName: string,
  expiryDate: Date
): Promise<string | null> {
  // Notify 24 hours before expiry
  const notifyDate = new Date(expiryDate);
  notifyDate.setHours(notifyDate.getHours() - 24);

  // Don't schedule if the notification time has passed
  if (notifyDate <= new Date()) {
    return null;
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Quote Expiring Soon',
        body: `${customerName}'s quote expires tomorrow. Send a follow-up?`,
        data: { type: 'quote_expiry', jobId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notifyDate,
      },
    });

    console.log('[Reminders] Scheduled quote expiry notification:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('[Reminders] Error scheduling quote expiry notification:', error);
    return null;
  }
}

/**
 * Clear old sent reminders (older than 30 days)
 */
export async function cleanupOldReminders(): Promise<void> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const reminders = await getSentReminders();
  const recentReminders = reminders.filter(
    (r) => new Date(r.sentAt) > thirtyDaysAgo
  );
  await saveSentReminders(recentReminders);

  const followups = await getQuoteFollowups();
  const recentFollowups = followups.filter(
    (f) => new Date(f.sentAt) > thirtyDaysAgo
  );
  await saveQuoteFollowups(recentFollowups);
}
