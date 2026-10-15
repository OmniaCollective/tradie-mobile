/**
 * Anonymous journey analytics (Aptabase): only these events, never a name, number,
 * address, amount or anything typed. Lets us see whether people get through the journey
 * (set up → job → quote → booked → invoice → paid) without knowing who they are.
 * App Privacy: "Usage data, not linked to you". Off when no key is set (e.g. local builds).
 */
import { init, trackEvent } from '@aptabase/react-native';

export type JourneyEvent =
  | 'setup_finished'
  | 'job_saved'
  | 'quote_sent'
  | 'booked'
  | 'invoice_sent'
  | 'marked_paid'
  | 'paywall_opened'
  | 'pro_started'
  | 'tax_year_exported'
  // 1.7: which price tools get used, and which Pro locks free users tap
  | 'line_item_added'
  | 'discount_added'
  | 'price_list_item_saved'
  | 'price_list_item_used'
  | 'parts_added_to_price'
  | 'logo_added'
  | 'pro_locked_tap_price_list'
  | 'pro_locked_tap_parts'
  | 'pro_locked_tap_profit';

const APP_KEY = process.env.EXPO_PUBLIC_APTABASE_APP_KEY;
let started = false;

/** Called once at launch. */
export function startAnalytics(): void {
  if (started || !APP_KEY || __DEV__) return;
  try {
    init(APP_KEY);
    started = true;
  } catch {
    // Analytics must never get in the way of the app.
  }
}

/** Records that a step of the journey happened. Safe to call anywhere; never throws. */
export function track(event: JourneyEvent): void {
  if (!started) return;
  try {
    trackEvent(event);
  } catch {
    // ignore
  }
}
