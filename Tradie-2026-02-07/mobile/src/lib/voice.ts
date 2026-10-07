/**
 * Voice jobs: the recording goes to Tradie's server, which transcribes it and
 * pulls out the job details. The AI key lives on the server, never in the app.
 * Free users get FREE_LIMITS.voiceJobs in total, counted by the server.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, ApiError, apiPost, getSessionToken } from './api';
import { toDateKey } from './dates';

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

/** Free voice jobs left, as last reported by the server (null = unknown or Pro). */
export const useVoiceAllowance = create<{ freeLeft: number | null; set: (n: number | null) => void }>()(
  persist(
    (set) => ({ freeLeft: null, set: (freeLeft) => set({ freeLeft }) }),
    { name: 'tradie-voice', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

/**
 * Words the speech recogniser should expect, so trade talk isn't misheard
 * (e.g. "leaking" heard as the name "Li King").
 */
function vocabularyHint(trade: string, jobTypes: string[]): string {
  return [
    `A ${trade.replace(/_/g, ' ')} describing a new job: customer name, address, the work and when.`,
    `Job types: ${jobTypes.join(', ')}.`,
    'Words: leaking, leak, dripping, blocked, burst, tap, toilet, boiler, radiator, socket, fuse box, quote, call-out, tomorrow, morning, afternoon.',
  ].join(' ');
}

async function transcribe(audioUri: string, hint: string): Promise<string> {
  const token = await getSessionToken();
  if (!token) throw new ApiError('UNAUTHORIZED', 'Please sign in', 401);

  let res: FileSystem.FileSystemUploadResult;
  try {
    res = await FileSystem.uploadAsync(`${API_URL}/api/voice/transcribe`, audioUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'audio/mp4',
      parameters: { hint },
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError('NETWORK', 'No internet connection', 0);
  }

  const body = JSON.parse(res.body || '{}') as { data?: { text: string }; error?: { code: string; message: string } };
  if (res.status !== 200 || !body.data) {
    throw new ApiError(body.error?.code ?? 'UPSTREAM_ERROR', body.error?.message ?? 'Transcription failed', res.status);
  }
  return body.data.text.trim();
}

/** Recording → words → job details. Throws ApiError (e.g. VOICE_LIMIT_REACHED, UNAUTHORIZED, NETWORK). */
export async function processVoiceNote(
  audioUri: string,
  trade: string,
  jobTypes: string[],
): Promise<{ transcription: string; extracted: ExtractedJobData }> {
  const transcription = await transcribe(audioUri, vocabularyHint(trade, jobTypes));
  if (!transcription) throw new ApiError('EMPTY', 'Nothing was heard', 200);

  const { extracted, freeVoiceJobsLeft } = await apiPost<{ extracted: ExtractedJobData; freeVoiceJobsLeft: number | null }>(
    '/api/voice/extract',
    { transcription, trade, jobTypes, today: toDateKey() },
  );
  useVoiceAllowance.getState().set(freeVoiceJobsLeft);
  return { transcription, extracted };
}
