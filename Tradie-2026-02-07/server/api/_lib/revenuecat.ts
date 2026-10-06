/**
 * RevenueCat REST API (v1). The app logs into RevenueCat with the Apple user id,
 * so that id is the RevenueCat app_user_id here too.
 * https://www.revenuecat.com/docs/api-v1
 */

const BASE = 'https://api.revenuecat.com/v1/subscribers';
export const PRO_ENTITLEMENT = 'pro';
export const FREE_VOICE_JOBS = 3;
const VOICE_COUNT_ATTRIBUTE = 'voice_jobs_used';

interface Subscriber {
  entitlements: Record<string, { expires_date: string | null }>;
  subscriber_attributes: Record<string, { value: string }>;
}

function headers(secretKey: string) {
  return { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' };
}

async function getSubscriber(secretKey: string, userId: string): Promise<Subscriber> {
  const res = await fetch(`${BASE}/${encodeURIComponent(userId)}`, { headers: headers(secretKey) });
  if (!res.ok) throw new Error(`RevenueCat lookup failed (${res.status})`);
  const body = (await res.json()) as { subscriber: Subscriber };
  return body.subscriber;
}

export interface VoiceAllowance {
  isPro: boolean;
  used: number;
  allowed: boolean;
}

export async function getVoiceAllowance(secretKey: string, userId: string): Promise<VoiceAllowance> {
  const subscriber = await getSubscriber(secretKey, userId);
  const pro = subscriber.entitlements[PRO_ENTITLEMENT];
  const isPro = !!pro && (pro.expires_date === null || Date.parse(pro.expires_date) > Date.now());
  const used = Number(subscriber.subscriber_attributes[VOICE_COUNT_ATTRIBUTE]?.value ?? 0) || 0;
  return { isPro, used, allowed: isPro || used < FREE_VOICE_JOBS };
}

/** Counts one free voice job. Stored on the RevenueCat customer, so reinstalling doesn't reset it. */
export async function recordVoiceJob(secretKey: string, userId: string, usedBefore: number): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(userId)}/attributes`, {
    method: 'POST',
    headers: headers(secretKey),
    body: JSON.stringify({ attributes: { [VOICE_COUNT_ATTRIBUTE]: { value: String(usedBefore + 1) } } }),
  });
  if (!res.ok) throw new Error(`RevenueCat attribute update failed (${res.status})`);
}

/** Deletes the customer and their attributes. A missing customer counts as deleted. */
export async function deleteSubscriber(secretKey: string, userId: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: headers(secretKey),
  });
  if (!res.ok && res.status !== 404) throw new Error(`RevenueCat delete failed (${res.status})`);
}
