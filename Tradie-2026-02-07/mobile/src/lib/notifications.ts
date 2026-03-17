import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = 'tradie-push-token';

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData extends Record<string, unknown> {
  type: 'new_booking' | 'booking_confirmed' | 'job_reminder' | 'payment_received';
  jobId?: string;
  customerId?: string;
  message?: string;
}

/**
 * Request permission and register for push notifications
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  let token: string | null = null;

  // Check if we're on a physical device
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get the Expo push token
  try {
    const pushTokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined, // Uses the project ID from app.json automatically
    });
    token = pushTokenData.data;

    // Store the token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    console.log('Push token:', token);
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }

  // Configure Android-specific notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('bookings', {
      name: 'New Bookings',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#14B8A6',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Job Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  return token;
}

/**
 * Get the stored push token
 */
export async function getStoredPushToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Schedule a local notification for job reminder
 */
export async function scheduleJobReminder(
  jobId: string,
  customerName: string,
  jobType: string,
  scheduledDate: Date,
  scheduledTime: string
): Promise<string | null> {
  // Schedule notification 1 hour before the job
  const triggerDate = new Date(scheduledDate);
  const [hours, minutes] = scheduledTime.split(':').map(Number);
  triggerDate.setHours(hours - 1, minutes, 0, 0);

  // Don't schedule if the reminder time has already passed
  if (triggerDate <= new Date()) {
    return null;
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Upcoming Job Reminder',
        body: `${jobType} for ${customerName} starts in 1 hour`,
        data: { type: 'job_reminder', jobId } as NotificationData,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });

    console.log('Scheduled reminder:', notificationId);
    return notificationId;
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return null;
  }
}

/**
 * Send a local notification for a new booking
 */
export async function sendNewBookingNotification(
  customerName: string,
  jobType: string,
  urgency: string
): Promise<void> {
  const urgencyEmoji = urgency === 'emergency' ? '🚨' : urgency === 'urgent' ? '⚡' : '📋';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${urgencyEmoji} New Booking Request`,
      body: `${customerName} needs ${jobType.toLowerCase().replace(/_/g, ' ')}`,
      data: { type: 'new_booking' } as NotificationData,
      sound: 'default',
    },
    trigger: null, // Immediate notification
  });
}

/**
 * Send notification when booking is confirmed
 */
export async function sendBookingConfirmedNotification(
  customerName: string,
  scheduledDate: string,
  scheduledTime: string
): Promise<void> {
  const formattedDate = new Date(scheduledDate).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Booking Confirmed',
      body: `${customerName} confirmed for ${formattedDate} at ${scheduledTime}`,
      data: { type: 'booking_confirmed' } as NotificationData,
      sound: 'default',
    },
    trigger: null,
  });
}

/**
 * Send notification when payment is received
 */
export async function sendPaymentReceivedNotification(
  customerName: string,
  amount: number
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '💰 Payment Received',
      body: `${customerName} paid £${amount.toFixed(2)}`,
      data: { type: 'payment_received' } as NotificationData,
      sound: 'default',
    },
    trigger: null,
  });
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Cancel a specific notification
 */
export async function cancelNotification(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

/**
 * Add listener for notification received while app is foregrounded
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Add listener for notification response (user tapped notification)
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
