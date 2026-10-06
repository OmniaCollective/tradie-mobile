/**
 * Customer Reminders Service
 *
 * Sends automated SMS reminders to customers before their scheduled jobs.
 * Also handles quote expiry follow-ups.
 */

import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Job, Customer } from './store';
import { formatTime, formatDateFull } from './dates';
import { formatMoney } from './money';

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
    if (__DEV__) console.log('[Reminders] SMS not available');
    return false;
  }

  // Check if reminder was already sent
  const sentReminders = await getSentReminders();
  const alreadySent = sentReminders.some(
    (r) => r.jobId === job.id && r.type === reminderType
  );

  if (alreadySent) {
    if (__DEV__) console.log('[Reminders] Reminder already sent for job:', job.id);
    return false;
  }

  const formattedTime = job.scheduledTime ? formatTime(job.scheduledTime) : 'your scheduled time';
  const formattedDate = job.scheduledDate ? formatDateFull(job.scheduledDate) : 'your scheduled date';

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
      if (__DEV__) console.log('[Reminders] Sent', reminderType, 'reminder for job:', job.id);
      return true;
    }

    return false;
  } catch (error) {
    if (__DEV__) console.error('[Reminders] Error sending SMS:', error);
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
    if (__DEV__) console.log('[Reminders] SMS not available');
    return false;
  }

  // Check if followup was already sent
  const followups = await getQuoteFollowups();
  const alreadySent = followups.some((f) => f.jobId === job.id);

  if (alreadySent) {
    if (__DEV__) console.log('[Reminders] Quote followup already sent for job:', job.id);
    return false;
  }

  const quoteTotal = job.quote?.total.toFixed(2) || '0.00';

  const message = `Hi ${customer.name},\n\nJust following up on your ${jobTypeLabel.toLowerCase()} quote for ${formatMoney(Number(quoteTotal))}.\n\nYour quote is expiring soon. Would you like to go ahead and book?\n\nReply YES to confirm, or let us know if you have any questions.\n\n${businessName}`;

  try {
    const { result } = await SMS.sendSMSAsync([customer.phone], message);

    if (result === 'sent' || result === 'unknown') {
      // Mark as sent
      const updatedFollowups = [
        ...followups,
        { jobId: job.id, sentAt: new Date().toISOString() },
      ];
      await saveQuoteFollowups(updatedFollowups);
      if (__DEV__) console.log('[Reminders] Sent quote followup for job:', job.id);
      return true;
    }

    return false;
  } catch (error) {
    if (__DEV__) console.error('[Reminders] Error sending quote followup:', error);
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
