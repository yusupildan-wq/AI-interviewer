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

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL,
  groqApiKey: process.env.GROQ_API_KEY,
  decisionEngineModel: process.env.DECISION_ENGINE_MODEL ?? 'openai/gpt-oss-120b',
  decisionEngineReasoningEffort: process.env.DECISION_ENGINE_REASONING_EFFORT ?? 'high',
  speechToTextModel: process.env.STT_MODEL ?? 'whisper-large-v3-turbo',
  textToSpeechModel: process.env.TTS_MODEL ?? 'canopylabs/orpheus-v1-english',
  textToSpeechVoice: process.env.TTS_VOICE ?? 'troy',
};
