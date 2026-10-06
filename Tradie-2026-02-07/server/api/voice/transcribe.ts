import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireEnv, requirePost, requireUser, sendError } from '../_lib/http.js';
import { TRANSCRIBE_MODEL } from '../_lib/models.js';
import { isRateLimited } from '../_lib/rateLimit.js';
import { FREE_VOICE_JOBS, getVoiceAllowance } from '../_lib/revenuecat.js';

// Raw multipart body, not Vercel's JSON parser.
export const config = { api: { bodyParser: false } };

function readBody(req: VercelRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** First file part of a multipart/form-data body (same parser as Arken's transcribe). */
function extractFile(body: Buffer, boundary: string): { data: Buffer; filename: string; contentType: string } | null {
  const marker = Buffer.from(`--${boundary}`);
  const parts: Buffer[] = [];
  let start = 0;
  while (true) {
    const idx = body.indexOf(marker, start);
    if (idx === -1) break;
    if (start > 0) parts.push(body.subarray(start, idx - 2));
    start = idx + marker.length + 2;
  }
  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headers = part.subarray(0, headerEnd).toString();
    if (!headers.includes('filename=')) continue;
    return {
      data: part.subarray(headerEnd + 4),
      filename: headers.match(/filename="([^"]+)"/)?.[1] ?? 'audio.m4a',
      contentType: headers.match(/Content-Type:\s*(.+)/i)?.[1]?.trim() ?? 'audio/mp4',
    };
  }
  return null;
}

/** POST multipart (field "file") → { data: { text } } */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;
  const userId = await requireUser(req, res);
  if (!userId) return;
  const env = requireEnv(res, 'GROQ_API_KEY', 'REVENUECAT_SECRET_KEY');
  if (!env) return;

  if (isRateLimited(`transcribe:${userId}`, 60_000, 10)) {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many voice notes, try again in a minute');
  }

  // Counting happens in /extract; here we only refuse users who are out of free voice jobs.
  // If RevenueCat is unreachable we let the request through: a voice outage is worse than
  // one uncounted free use.
  try {
    const allowance = await getVoiceAllowance(env.REVENUECAT_SECRET_KEY, userId);
    if (!allowance.allowed) {
      return sendError(res, 402, 'VOICE_LIMIT_REACHED', `You've used your ${FREE_VOICE_JOBS} free voice jobs`);
    }
  } catch (err) {
    console.error('Voice allowance check failed, allowing:', err);
  }

  const boundary = (req.headers['content-type'] ?? '').match(/boundary=(.+)/)?.[1];
  if (!boundary) return sendError(res, 400, 'VALIDATION_ERROR', 'Expected multipart/form-data');

  const file = extractFile(await readBody(req), boundary);
  if (!file) return sendError(res, 400, 'VALIDATION_ERROR', 'No audio file in request');

  const form = new FormData();
  form.append('file', new Blob([Uint8Array.from(file.data)], { type: file.contentType }), file.filename);
  form.append('model', TRANSCRIBE_MODEL);
  form.append('language', 'en');

  const groq = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: form,
  });
  if (!groq.ok) {
    console.error('Groq transcription error:', groq.status, await groq.text());
    return sendError(res, 502, 'UPSTREAM_ERROR', 'Transcription failed');
  }

  const result = (await groq.json()) as { text?: string };
  return res.status(200).json({ data: { text: result.text ?? '' } });
}
