/**
 * Shared date formatting utilities.
 * All date/time display formatting should go through these functions
 * to ensure consistent en-GB locale across the app.
 */

/** Format an ISO date string to "Mon 1 Jan" */
export function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Format an ISO date string to "Mon 1 Jan 2026" (includes year) */
export function formatDateLong(dateStr?: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format a Date object to "Mon 1 Jan" */
export function formatDateObj(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Format a Date object to "Mon 1 Jan 2026" */
export function formatDateObjLong(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format an ISO date string to "1 Jan 2026" (day, short month, year — no weekday) */
export function formatDateWithYear(dateStr?: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Format an ISO date string to "Monday 1 January" (long form, no year) */
export function formatDateFull(dateStr?: string): string {
  if (!dateStr) return 'Not scheduled';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Not scheduled';
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Format an "HH:MM" time string to "10:00 AM" */
export function formatTime(time?: string): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time;
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/** Format a Date object's time to "10:00 AM" */
export function formatTimeObj(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${m.toString().padStart(2, '0')} ${ampm}`;
}
