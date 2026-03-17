import * as FileSystem from 'expo-file-system';
import { Trade } from './trades';
import { PricingPreset } from './store';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;
const GROK_API_KEY = process.env.EXPO_PUBLIC_VIBECODE_GROK_API_KEY;

export interface ExtractedJobData {
  customerName?: string;
  phone?: string;
  address?: string;
  postcode?: string;
  jobType?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  description?: string;
  urgency?: string;
}

/**
 * Transcribe audio using Groq's Whisper API.
 * Groq runs Whisper (open-source speech model) on fast inference hardware — free and fast.
 * Uses FileSystem.uploadAsync for reliable multipart file uploads (proven pattern from Vulcan).
 */
export async function transcribeAudio(audioUri: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API key not configured');
  }

  const response = await FileSystem.uploadAsync(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    audioUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'audio/mp4',
      parameters: {
        model: 'whisper-large-v3-turbo',
        language: 'en',
      },
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
    }
  );

  if (response.status !== 200) {
    const errorBody = response.body || 'No response body';
    throw new Error(`Groq transcription error (${response.status}): ${errorBody}`);
  }

  const result = JSON.parse(response.body);
  return result.text;
}

/**
 * Extract structured job details from a transcription using Grok (xAI).
 */
export async function extractJobDetails(
  transcription: string,
  tradeType: Trade,
  jobTypes: PricingPreset[]
): Promise<ExtractedJobData> {
  if (!GROK_API_KEY) {
    throw new Error('Grok API key not configured');
  }

  const jobTypeLabels = jobTypes.map((j) => j.label).join(', ');
  const today = new Date().toISOString().split('T')[0];

  const prompt = `You are extracting job booking details from a voice note transcription by a tradesperson (${tradeType}).

Today's date is ${today}.

Available job types: ${jobTypeLabels}

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
- For relative dates like "tomorrow", "next Tuesday", "Friday", convert to actual dates based on today (${today}).
- For jobType, match to the closest available job type label. Use exact label text.
- Use null for any field not mentioned.`;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [
        { role: 'system', content: 'You extract structured data from text. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Extraction failed: ${error}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new Error('No response from Grok');
  }

  // Parse JSON — handle potential markdown code blocks
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);

  // Clean nulls
  const result: ExtractedJobData = {};
  if (parsed.customerName) result.customerName = parsed.customerName;
  if (parsed.phone) result.phone = parsed.phone;
  if (parsed.address) result.address = parsed.address;
  if (parsed.postcode) result.postcode = parsed.postcode;
  if (parsed.jobType) result.jobType = parsed.jobType;
  if (parsed.scheduledDate) result.scheduledDate = parsed.scheduledDate;
  if (parsed.scheduledTime) result.scheduledTime = parsed.scheduledTime;
  if (parsed.description) result.description = parsed.description;
  if (parsed.urgency) result.urgency = parsed.urgency;

  return result;
}

/**
 * Full pipeline: transcribe audio then extract job details.
 * Step 1: Groq Whisper (audio → text) — fast, free
 * Step 2: Grok xAI (text → structured job data) — smart extraction
 */
export async function processVoiceNote(
  audioUri: string,
  tradeType: Trade,
  jobTypes: PricingPreset[]
): Promise<{ transcription: string; extracted: ExtractedJobData }> {
  const transcription = await transcribeAudio(audioUri);
  const extracted = await extractJobDetails(transcription, tradeType, jobTypes);
  return { transcription, extracted };
}
