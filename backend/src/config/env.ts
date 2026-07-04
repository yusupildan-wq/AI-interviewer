import dotenv from 'dotenv';

dotenv.config();

const parsePort = (value: string | undefined): number => {
  const fallbackPort = 4000;

  if (!value) {
    return fallbackPort;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT value: ${value}`);
  }

  return port;
};

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer value: ${value}`);
  }

  return parsed;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  groqApiKey: process.env.GROQ_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  // Runs on OpenAI (same key as text-to-speech below) rather than Groq's free tier —
  // Groq's shared 8000 TPM/minute cap throttled after 1-2 real conversational turns and
  // fell back to a generic reply; OpenAI held up over 5 rapid-fire requests in testing.
  decisionEngineModel: process.env.DECISION_ENGINE_MODEL ?? 'gpt-4o-mini',
  // Safety net only, in case the model call genuinely hangs — not a routine truncation.
  decisionEngineTimeoutMs: parsePositiveInteger(process.env.DECISION_ENGINE_TIMEOUT_MS, 10000),
  conversationEngineTimeoutMs: parsePositiveInteger(
    process.env.CONVERSATION_ENGINE_TIMEOUT_MS,
    2200,
  ),
  speechToTextModel: process.env.STT_MODEL ?? 'whisper-large-v3-turbo',
  voiceProvider: process.env.VOICE_PROVIDER ?? 'openai',
  openaiTextToSpeechModel: process.env.OPENAI_TTS_MODEL ?? 'gpt-4o-mini-tts',
  openaiTextToSpeechVoice: process.env.OPENAI_TTS_VOICE ?? 'marin',
  openaiTextToSpeechInstructions:
    process.env.OPENAI_TTS_INSTRUCTIONS ??
    'Speak like a calm, natural senior technical interviewer on a video call. Sound conversational, warm, and human. Use subtle pauses, natural pacing, and mild intonation. Do not sound like a narrator, announcer, or robot.',
  textToSpeechModel: process.env.TTS_MODEL ?? 'canopylabs/orpheus-v1-english',
  textToSpeechVoice: process.env.TTS_VOICE ?? 'troy',
  // Signs the auth session cookie. A dev fallback keeps `npm run dev` working out of the
  // box; production must set a real secret or every restart invalidates all sessions.
  sessionSecret:
    process.env.SESSION_SECRET ??
    (process.env.NODE_ENV === 'production' ? undefined : 'dev-only-insecure-session-secret'),
  sessionTtlMs: 30 * 24 * 60 * 60 * 1000, // 30 days
};

if (env.nodeEnv === 'production' && !env.sessionSecret) {
  throw new Error('SESSION_SECRET must be set in production.');
}
