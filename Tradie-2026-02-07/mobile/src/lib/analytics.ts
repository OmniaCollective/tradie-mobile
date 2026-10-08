/**
 * Anonymous journey analytics (Aptabase): only these eight events, never a name, number,
 * address, amount or anything typed. Lets us see whether people get through the journey
 * (set up → job → quote → booked → invoice → paid) without knowing who they are.
 * App Privacy: "Usage data, not linked to you". Off when no key is set (e.g. local builds).
 */
import Aptabase from '@aptabase/react-native';

export type JourneyEvent =
  'setup_finished' | 'job_saved' | 'quote_sent' | 'booked' | 'invoice_sent' | 'marked_paid' | 'paywall_opened' | 'pro_started';

const APP_KEY = process.env.EXPO_PUBLIC_APTABASE_APP_KEY;
let started = false;

/** Called once at launch. */
export function startAnalytics(): void {
  if (started || !APP_KEY || __DEV__) return;
  try {
    Aptabase.init(APP_KEY);
    started = true;
  } catch {
    // Analytics must never get in the way of the app.
  }
}

/** Records that a step of the journey happened. Safe to call anywhere; never throws. */
export function track(event: JourneyEvent): void {
  if (!started) return;
  try {
    Aptabase.trackEvent(event);
  } catch {
    // ignore
  }
}
