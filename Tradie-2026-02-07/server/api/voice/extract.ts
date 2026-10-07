import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireEnv, requirePost, requireUser, sendError } from '../_lib/http.js';
import { EXTRACT_MODEL } from '../_lib/models.js';
import { isRateLimited } from '../_lib/rateLimit.js';
import { FREE_VOICE_JOBS, getVoiceAllowance, recordVoiceJob, type VoiceAllowance } from '../_lib/revenuecat.js';

interface ExtractRequest {
  transcription: string;
  trade: string;
  jobTypes: string[];
  /** The phone's local date (YYYY-MM-DD), so "tomorrow" means the user's tomorrow. */
  today: string;
}

const FIELDS = [
  'customerName', 'phone', 'address', 'postcode', 'jobType',
  'scheduledDate', 'scheduledTime', 'description', 'urgency',
] as const;

function parseRequest(body: unknown): ExtractRequest | null {
  const b = body as Partial<ExtractRequest> | undefined;
  if (!b || typeof b.transcription !== 'string' || !b.transcription.trim()) return null;
  if (typeof b.trade !== 'string' || typeof b.today !== 'string') return null;
  if (!Array.isArray(b.jobTypes) || !b.jobTypes.every((j) => typeof j === 'string')) return null;
  return {
    transcription: b.transcription.slice(0, 4000),
    trade: b.trade.slice(0, 50),
    jobTypes: b.jobTypes.slice(0, 50),
    today: b.today.slice(0, 10),
  };
}

function buildPrompt({ transcription, trade, jobTypes, today }: ExtractRequest): string {
  return `You are extracting job booking details from a voice note transcription by a tradesperson (${trade}).

Today's date is ${today}.

Available job types: ${jobTypes.join(', ')}

Transcription: "${transcription}"

Extract any mentioned details and return ONLY valid JSON (no markdown, no explanation):
{
  "customerName": "string or null",
  "phone": "string or null",
  "address": "string or null",
  "postcode": "string or null",
  "jobType": "one of the available job types or null",
  "scheduledDate": "ISO date string (YYYY-MM-DD) or null",
  "scheduledTime": "HH:MM (24h format) or null",
  "description": "brief description of the work or null",
  "urgency": "standard, urgent, or emergency - null if not mentioned"
}

Rules:
- Only include fields that were clearly mentioned or can be reasonably inferred.
- customerName is only a person's or business's name that the speaker gives for the customer (e.g. "for Sarah Jones", "Mike at number 4"). Never use words that describe the work, the problem or the room. Speech-to-text often mishears trade words as names (e.g. "Li King" for "leaking", "Bo Ler" for "boiler"); treat those as the job, not a name. If no customer is clearly named, use null.
- In description, correct obvious mishearings of trade words (e.g. "Li King bathroom tap" means "leaking bathroom tap").
- For relative dates like "tomorrow", "next Tuesday", "Friday", convert to actual dates based on today (${today}).
- For jobType, match to the closest available job type label. Use exact label text.
- Use null for any field not mentioned.`;
}

/** POST ExtractRequest → { data: { extracted, freeVoiceJobsLeft } } (freeVoiceJobsLeft is null for Pro) */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requirePost(req, res)) return;
  const userId = await requireUser(req, res);
  if (!userId) return;
  const env = requireEnv(res, 'GROQ_API_KEY', 'REVENUECAT_SECRET_KEY');
  if (!env) return;

  const request = parseRequest(req.body);
  if (!request) return sendError(res, 400, 'VALIDATION_ERROR', 'Invalid request');

  if (isRateLimited(`extract:${userId}`, 60_000, 10)) {
    return sendError(res, 429, 'RATE_LIMITED', 'Too many voice notes, try again in a minute');
  }

  // Fails open like /transcribe: if RevenueCat is down the job goes through uncounted.
  let allowance: VoiceAllowance | null = null;
  try {
    allowance = await getVoiceAllowance(env.REVENUECAT_SECRET_KEY, userId);
    if (!allowance.allowed) {
      return sendError(res, 402, 'VOICE_LIMIT_REACHED', `You've used your ${FREE_VOICE_JOBS} free voice jobs`);
    }
  } catch (err) {
    console.error('Voice allowance check failed, allowing:', err);
  }

  const groq = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: EXTRACT_MODEL,
      messages: [
        { role: 'system', content: 'You extract structured data from text. Always respond with valid JSON only.' },
        { role: 'user', content: buildPrompt(request) },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });
  if (!groq.ok) {
    console.error('Groq extraction error:', groq.status, await groq.text());
    return sendError(res, 502, 'UPSTREAM_ERROR', 'Could not read the voice note');
  }

  const content = ((await groq.json()) as { choices?: { message?: { content?: string } }[] })
    .choices?.[0]?.message?.content?.trim();

  let parsed: Record<string, unknown>;
  try {
    const json = content?.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? content ?? '';
    parsed = JSON.parse(json);
  } catch {
    console.error('Extraction returned non-JSON:', content);
    return sendError(res, 502, 'UPSTREAM_ERROR', 'Could not read the voice note');
  }

  const extracted: Record<string, string> = {};
  for (const field of FIELDS) {
    const value = parsed[field];
    if (typeof value === 'string' && value.trim()) extracted[field] = value.trim();
  }

  // Only a successful job counts towards the free allowance.
  let freeVoiceJobsLeft: number | null = null;
  if (allowance && !allowance.isPro) {
    try {
      await recordVoiceJob(env.REVENUECAT_SECRET_KEY, userId, allowance.used);
    } catch (err) {
      console.error('Could not record voice job:', err);
    }
    freeVoiceJobsLeft = Math.max(0, FREE_VOICE_JOBS - allowance.used - 1);
  }

  return res.status(200).json({ data: { extracted, freeVoiceJobsLeft } });
}
