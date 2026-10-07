/**
 * Features that can be switched off for a release without removing their code.
 *
 * Voice job entry is off for 1.6: it could irritate people when it mishears, and
 * most tradies type. The iPhone keyboard's own dictation covers notes and to-dos.
 * See release/fix-plan-build-28.md ("Later") for how it might come back.
 */
export const VOICE_ENABLED = false;
