import type { VercelRequest, VercelResponse } from '@vercel/node';
import { importPKCS8 } from 'jose';
import { EXTRACT_MODEL, TRANSCRIBE_MODEL } from './_lib/models.js';
import { geocodeAll, mapsConfigured } from './_lib/maps.js';

type Check = { ok: boolean; detail?: string };

async function checkGroq(): Promise<Check> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return { ok: false, detail: 'GROQ_API_KEY not set' };
  const res = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${key}` } });
  if (res.status === 401) return { ok: false, detail: 'key rejected (deleted or revoked?)' };
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
  const ids = ((await res.json()) as { data: { id: string }[] }).data.map((m) => m.id);
  const missing = [TRANSCRIBE_MODEL, EXTRACT_MODEL].filter((m) => !ids.includes(m));
  return missing.length ? { ok: false, detail: `model retired: ${missing.join(', ')}` } : { ok: true };
}

async function checkRevenueCat(): Promise<Check> {
  const key = process.env.REVENUECAT_SECRET_KEY;
  if (!key) return { ok: false, detail: 'REVENUECAT_SECRET_KEY not set' };
  const res = await fetch('https://api.revenuecat.com/v1/subscribers/health-check', {
    headers: { Authorization: `Bearer ${key}` },
  });
  return res.ok ? { ok: true } : { ok: false, detail: `HTTP ${res.status}` };
}

async function checkApple(): Promise<Check> {
  const names = ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_BUNDLE_ID', 'APPLE_PRIVATE_KEY'];
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) return { ok: false, detail: `not set: ${missing.join(', ')}` };
  try {
    await importPKCS8(process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'ES256');
    return { ok: true };
  } catch {
    return { ok: false, detail: 'APPLE_PRIVATE_KEY is not a valid .p8 key' };
  }
}

async function checkMaps(): Promise<Check> {
  if (!mapsConfigured()) return { ok: false, detail: 'Apple Maps key not set — using drive-time estimates' };
  try {
    const { coords, source } = await geocodeAll(['SW1A 1AA']);
    return coords.get('SW1A 1AA') && source === 'apple' ? { ok: true } : { ok: false, detail: 'Apple Maps lookup failed' };
  } catch (e) {
    return { ok: false, detail: String(e) };
  }
}

/** GET → which keys work. Reports problems without revealing any secret. */
export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const [groq, revenuecat, apple, maps] = await Promise.all([
    checkGroq().catch((e) => ({ ok: false, detail: String(e) })),
    checkRevenueCat().catch((e) => ({ ok: false, detail: String(e) })),
    checkApple(),
    checkMaps(),
  ]);
  const session: Check = process.env.SESSION_SECRET ? { ok: true } : { ok: false, detail: 'SESSION_SECRET not set' };
  const checks = { groq, revenuecat, apple, session, maps };
  const ok = Object.values(checks).every((c) => c.ok);
  return res.status(ok ? 200 : 503).json({ ok, checks });
}
