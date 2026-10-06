import { SignJWT, importPKCS8 } from 'jose';

/**
 * Drive times for "Suggest times".
 *
 * Primary: Apple Maps Server API (real road ETAs, UK and US). Needs a Maps key
 * from the Apple developer account (APPLE_MAPS_KEY_ID + APPLE_MAPS_PRIVATE_KEY).
 * Fallback: postcodes.io (UK only, free, no key) plus a straight-line estimate,
 * so suggestions still work if Apple Maps is unavailable.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export type TravelSource = 'apple' | 'estimate';

const APPLE = 'https://maps-api.apple.com/v1';

// Postcode → coordinates rarely changes; keep lookups for the life of the instance.
const geocodeCache = new Map<string, LatLng | null>();
let appleToken: { value: string; expiresAt: number } | null = null;

const normalise = (place: string) => place.trim().toUpperCase().replace(/\s+/g, ' ');

function appleConfigured(): boolean {
  return !!(process.env.APPLE_TEAM_ID && process.env.APPLE_MAPS_KEY_ID && process.env.APPLE_MAPS_PRIVATE_KEY);
}

/** Short-lived Maps access token, from a JWT signed with the Maps key. */
async function appleAccessToken(): Promise<string> {
  if (appleToken && appleToken.expiresAt > Date.now() + 60_000) return appleToken.value;
  const key = await importPKCS8(process.env.APPLE_MAPS_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'ES256');
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: process.env.APPLE_MAPS_KEY_ID!, typ: 'JWT' })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(key);
  const res = await fetch(`${APPLE}/token`, { headers: { Authorization: `Bearer ${jwt}` } });
  if (!res.ok) throw new Error(`Apple Maps token failed (${res.status}): ${await res.text()}`);
  const body = (await res.json()) as { accessToken: string; expiresInSeconds: number };
  appleToken = { value: body.accessToken, expiresAt: Date.now() + body.expiresInSeconds * 1000 };
  return body.accessToken;
}

async function appleGeocode(place: string): Promise<LatLng | null> {
  const token = await appleAccessToken();
  const url = `${APPLE}/geocode?q=${encodeURIComponent(place)}&limitToCountries=GB,US`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Apple geocode failed (${res.status})`);
  const body = (await res.json()) as { results?: { coordinate: { latitude: number; longitude: number } }[] };
  const c = body.results?.[0]?.coordinate;
  return c ? { lat: c.latitude, lng: c.longitude } : null;
}

async function postcodesIoGeocode(places: string[]): Promise<Map<string, LatLng | null>> {
  const out = new Map<string, LatLng | null>();
  if (places.length === 0) return out;
  const res = await fetch('https://api.postcodes.io/postcodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postcodes: places.slice(0, 100) }),
  });
  if (!res.ok) throw new Error(`postcodes.io failed (${res.status})`);
  const body = (await res.json()) as {
    result: { query: string; result: { latitude: number; longitude: number } | null }[];
  };
  for (const r of body.result) {
    out.set(normalise(r.query), r.result ? { lat: r.result.latitude, lng: r.result.longitude } : null);
  }
  return out;
}

/** Coordinates for each place (postcode or address); null where it couldn't be found. */
export async function geocodeAll(places: string[]): Promise<{ coords: Map<string, LatLng | null>; source: TravelSource }> {
  const wanted = [...new Set(places.map(normalise))];
  const missing = wanted.filter((p) => !geocodeCache.has(p));
  let source: TravelSource = appleConfigured() ? 'apple' : 'estimate';

  if (missing.length > 0) {
    if (source === 'apple') {
      try {
        const found = await Promise.all(missing.map((p) => appleGeocode(p).then((c) => [p, c] as const)));
        for (const [p, c] of found) geocodeCache.set(p, c);
      } catch (err) {
        console.error('Apple geocode unavailable, falling back:', err);
        source = 'estimate';
      }
    }
    const stillMissing = missing.filter((p) => !geocodeCache.has(p));
    if (stillMissing.length > 0) {
      try {
        const found = await postcodesIoGeocode(stillMissing);
        for (const p of stillMissing) geocodeCache.set(p, found.get(p) ?? null);
      } catch (err) {
        console.error('postcodes.io unavailable:', err);
      }
    }
  }

  const coords = new Map<string, LatLng | null>();
  for (const p of wanted) coords.set(p, geocodeCache.get(p) ?? null);
  return { coords, source };
}

/** Straight-line distance in km. */
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Fallback estimate: roads run ~1.4× the straight line; ~40 km/h average across
 * town and suburban driving; 5 minutes to park and get going.
 */
export function estimateMinutes(a: LatLng, b: LatLng): number {
  return Math.round((haversineKm(a, b) * 1.4 * 60) / 40 + 5);
}

/** Driving minutes from origin to each destination (null if a place couldn't be found). */
export async function driveMinutes(
  origin: LatLng,
  destinations: (LatLng | null)[],
  source: TravelSource,
): Promise<{ minutes: (number | null)[]; source: TravelSource }> {
  const fallback = () => destinations.map((d) => (d ? estimateMinutes(origin, d) : null));
  if (source !== 'apple') return { minutes: fallback(), source: 'estimate' };

  try {
    const token = await appleAccessToken();
    const minutes: (number | null)[] = destinations.map(() => null);
    const indexed = destinations.map((d, i) => ({ d, i })).filter((x): x is { d: LatLng; i: number } => !!x.d);
    // Apple accepts up to 10 destinations per request.
    for (let start = 0; start < indexed.length; start += 10) {
      const batch = indexed.slice(start, start + 10);
      const url =
        `${APPLE}/etas?origin=${origin.lat},${origin.lng}` +
        `&destinations=${batch.map(({ d }) => `${d.lat},${d.lng}`).join('|')}&transportType=Automobile`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Apple ETA failed (${res.status})`);
      const body = (await res.json()) as { etas?: { expectedTravelTimeSeconds: number }[] };
      (body.etas ?? []).forEach((eta, k) => {
        minutes[batch[k].i] = Math.max(1, Math.round(eta.expectedTravelTimeSeconds / 60));
      });
    }
    return { minutes, source: 'apple' };
  } catch (err) {
    console.error('Apple ETA unavailable, estimating:', err);
    return { minutes: fallback(), source: 'estimate' };
  }
}

export function mapsConfigured(): boolean {
  return appleConfigured();
}
