import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requirePost, requireUser, sendError } from '../_lib/http.js';
import { isRateLimited } from '../_lib/rateLimit.js';
import { geocodeAll, driveMinutes } from '../_lib/maps.js';

/**
 * POST { origin: "SE1 7TP", places: ["SW1A 1AA", "N1 9GU", ...] }
 *   → { data: { minutes: [12, 25, null, ...], found: boolean, source: "apple" | "estimate" } }
 *
 * Driving minutes from the new customer's postcode to each place (the
 * tradie's base and other booked jobs). Only postcodes are sent — never names
 * or job details. Travel is treated as symmetric, which is accurate enough to
 * rank appointment times.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;
  const userId = await requireUser(req, res);
  if (!userId) return;

  const origin = req.body?.origin;
  const places = req.body?.places;
  if (typeof origin !== 'string' || !origin.trim() || !Array.isArray(places) || !places.every((p) => typeof p === 'string')) {
    return sendError(res, 400, 'VALIDATION_ERROR', 'origin and places are required');
  }
  if (places.length > 40) return sendError(res, 400, 'VALIDATION_ERROR', 'Too many places');
  if (isRateLimited(`travel:${userId}`, 60_000, 20)) {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many requests, try again in a minute');
  }

  const { coords, source } = await geocodeAll([origin, ...places]);
  const from = coords.get(origin.trim().toUpperCase().replace(/\s+/g, ' ')) ?? null;
  if (!from) {
    return res.status(200).json({ data: { minutes: places.map(() => null), found: false, source } });
  }
  const destinations = places.map((p) => coords.get(p.trim().toUpperCase().replace(/\s+/g, ' ')) ?? null);
  const result = await driveMinutes(from, destinations, source);
  return res.status(200).json({ data: { minutes: result.minutes, found: true, source: result.source } });
}
