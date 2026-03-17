/**
 * Calendar Sync Service
 *
 * Syncs TRADIE jobs with the device's native calendar (Apple Calendar, Google Calendar, etc.)
 * Creates events with job details, customer info, and location for navigation.
 */

import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Job, Customer } from './store';

const CALENDAR_NAME = 'TRADIE Jobs';
const CALENDAR_ID_KEY = 'tradie-calendar-id';
const SYNCED_EVENTS_KEY = 'tradie-synced-events';

interface SyncedEvent {
  jobId: string;
  eventId: string;
  lastSynced: string;
}

/**
 * Request calendar permissions
 */
export async function requestCalendarPermissions(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Check if calendar permissions are granted
 */
export async function hasCalendarPermissions(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Get or create the TRADIE calendar
 */
async function getOrCreateCalendar(): Promise<string | null> {
  try {
    // Check if we have a stored calendar ID
    const storedCalendarId = await AsyncStorage.getItem(CALENDAR_ID_KEY);

    if (storedCalendarId) {
      // Verify the calendar still exists
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      const exists = calendars.some((cal) => cal.id === storedCalendarId);

      if (exists) {
        return storedCalendarId;
      }
    }

    // Create a new calendar
    const defaultCalendarSource =
      Platform.OS === 'ios'
        ? await getDefaultCalendarSource()
        : { isLocalAccount: true, name: CALENDAR_NAME, type: Calendar.SourceType.LOCAL };

    if (!defaultCalendarSource) {
      console.log('[Calendar] No calendar source available');
      return null;
    }

    const calendarId = await Calendar.createCalendarAsync({
      title: CALENDAR_NAME,
      color: '#14B8A6', // Turquoise
      entityType: Calendar.EntityTypes.EVENT,
      sourceId: defaultCalendarSource.id,
      source: defaultCalendarSource,
      name: CALENDAR_NAME,
      ownerAccount: 'TRADIE',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });

    await AsyncStorage.setItem(CALENDAR_ID_KEY, calendarId);
    console.log('[Calendar] Created TRADIE calendar:', calendarId);

    return calendarId;
  } catch (error) {
    console.error('[Calendar] Error getting/creating calendar:', error);
    return null;
  }
}

/**
 * Get the default calendar source for iOS
 */
async function getDefaultCalendarSource() {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);

  // Prefer iCloud calendar
  const iCloudCalendar = calendars.find(
    (cal) => cal.source.type === Calendar.SourceType.CALDAV && cal.source.name === 'iCloud'
  );
  if (iCloudCalendar) {
    return iCloudCalendar.source;
  }

  // Fall back to local calendar
  const localCalendar = calendars.find((cal) => cal.source.type === Calendar.SourceType.LOCAL);
  if (localCalendar) {
    return localCalendar.source;
  }

  // Use any available calendar source
  return calendars[0]?.source;
}

/**
 * Get stored synced events mapping
 */
async function getSyncedEvents(): Promise<SyncedEvent[]> {
  try {
    const data = await AsyncStorage.getItem(SYNCED_EVENTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save synced events mapping
 */
async function saveSyncedEvents(events: SyncedEvent[]): Promise<void> {
  await AsyncStorage.setItem(SYNCED_EVENTS_KEY, JSON.stringify(events));
}

/**
 * Sync a single job to the device calendar
 */
export async function syncJobToCalendar(
  job: Job,
  customer: Customer,
  jobTypeLabel: string
): Promise<boolean> {
  if (!job.scheduledDate || !job.scheduledTime) {
    return false;
  }

  const hasPermission = await hasCalendarPermissions();
  if (!hasPermission) {
    console.log('[Calendar] No permission to sync');
    return false;
  }

  const calendarId = await getOrCreateCalendar();
  if (!calendarId) {
    return false;
  }

  try {
    // Parse scheduled date and time
    const [hours, minutes] = job.scheduledTime.split(':').map(Number);
    const startDate = new Date(job.scheduledDate);
    startDate.setHours(hours, minutes, 0, 0);

    // Estimate 2 hours for job duration
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 2);

    // Build event details
    const location = `${customer.address}, ${customer.postcode}`;
    const notes = [
      `Customer: ${customer.name}`,
      `Phone: ${customer.phone}`,
      customer.email ? `Email: ${customer.email}` : '',
      '',
      job.description || '',
      '',
      job.quote ? `Quote: £${job.quote.total.toFixed(2)}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    // Check if event already exists
    const syncedEvents = await getSyncedEvents();
    const existingSync = syncedEvents.find((e) => e.jobId === job.id);

    let eventId: string;

    if (existingSync) {
      // Update existing event
      await Calendar.updateEventAsync(existingSync.eventId, {
        title: `${jobTypeLabel} - ${customer.name}`,
        startDate,
        endDate,
        location,
        notes,
        alarms: [
          { relativeOffset: -60 }, // 1 hour before
          { relativeOffset: -15 }, // 15 minutes before
        ],
      });
      eventId = existingSync.eventId;
      console.log('[Calendar] Updated event:', eventId);
    } else {
      // Create new event
      eventId = await Calendar.createEventAsync(calendarId, {
        title: `${jobTypeLabel} - ${customer.name}`,
        startDate,
        endDate,
        location,
        notes,
        alarms: [
          { relativeOffset: -60 }, // 1 hour before
          { relativeOffset: -15 }, // 15 minutes before
        ],
      });
      console.log('[Calendar] Created event:', eventId);

      // Save mapping
      const updatedSyncedEvents = [
        ...syncedEvents.filter((e) => e.jobId !== job.id),
        { jobId: job.id, eventId, lastSynced: new Date().toISOString() },
      ];
      await saveSyncedEvents(updatedSyncedEvents);
    }

    return true;
  } catch (error) {
    console.error('[Calendar] Error syncing job:', error);
    return false;
  }
}

/**
 * Remove a job from the device calendar
 */
export async function removeJobFromCalendar(jobId: string): Promise<boolean> {
  try {
    const syncedEvents = await getSyncedEvents();
    const syncedEvent = syncedEvents.find((e) => e.jobId === jobId);

    if (!syncedEvent) {
      return true; // Nothing to remove
    }

    await Calendar.deleteEventAsync(syncedEvent.eventId);

    // Remove from mapping
    const updatedSyncedEvents = syncedEvents.filter((e) => e.jobId !== jobId);
    await saveSyncedEvents(updatedSyncedEvents);

    console.log('[Calendar] Removed event for job:', jobId);
    return true;
  } catch (error) {
    console.error('[Calendar] Error removing job:', error);
    return false;
  }
}

/**
 * Sync all scheduled jobs to the device calendar
 */
export async function syncAllJobsToCalendar(
  jobs: Job[],
  getCustomer: (id: string) => Customer | undefined,
  getJobTypeLabel: (type: string) => string
): Promise<{ synced: number; failed: number }> {
  const scheduledJobs = jobs.filter(
    (j) => j.status === 'SCHEDULED' && j.scheduledDate && j.scheduledTime
  );

  let synced = 0;
  let failed = 0;

  for (const job of scheduledJobs) {
    const customer = getCustomer(job.customerId);
    if (!customer) {
      failed++;
      continue;
    }

    const success = await syncJobToCalendar(job, customer, getJobTypeLabel(job.type));
    if (success) {
      synced++;
    } else {
      failed++;
    }
  }

  return { synced, failed };
}

/**
 * Check if calendar sync is enabled (user has granted permission and has a calendar)
 */
export async function isCalendarSyncEnabled(): Promise<boolean> {
  const hasPermission = await hasCalendarPermissions();
  if (!hasPermission) return false;

  const calendarId = await AsyncStorage.getItem(CALENDAR_ID_KEY);
  return !!calendarId;
}
