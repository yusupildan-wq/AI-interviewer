import Groq, { toFile } from 'groq-sdk';

import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http-error.js';
import { getGroqClient } from '../llm/groq-client.js';

const MAX_TTS_CHARS = 2000;
const MAX_SPOKEN_CHARS = 700;
const OPENAI_SPEECH_ENDPOINT = 'https://api.openai.com/v1/audio/speech';

const prepareTextForSpeech = (text: string): string =>
  text
    .replace(/```[\s\S]*?```/g, ' code omitted ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SPOKEN_CHARS);

export const transcribeAudio = async (audio: Buffer, contentType: string): Promise<string> => {
  const client = getGroqClient();

  try {
    const file = await toFile(audio, 'turn.webm', { type: contentType || 'audio/webm' });
    const transcription = await client.audio.transcriptions.create({
      file,
      model: env.speechToTextModel,
      response_format: 'json',
    });
    return transcription.text.trim();
  } catch (caught) {
    if (caught instanceof Groq.APIError) {
      const status =
        caught.status && caught.status >= 400 && caught.status < 500 ? caught.status : 502;
      throw new HttpError(status, `Speech-to-text request failed: ${caught.message}`);
    }
    throw caught;
  }
};

export const synthesizeSpeech = async (text: string): Promise<Buffer> => {
  const trimmed = prepareTextForSpeech(text).slice(0, MAX_TTS_CHARS);

  if (!trimmed) {
    throw new HttpError(400, 'No text provided to synthesize.');
  }

  if (env.voiceProvider === 'openai') {
    return synthesizeOpenAiSpeech(trimmed);
  }

  return synthesizeGroqSpeech(trimmed);
};

const synthesizeOpenAiSpeech = async (text: string): Promise<Buffer> => {
  if (!env.openaiApiKey) {
    throw new HttpError(500, 'OPENAI_API_KEY is required for OpenAI text-to-speech.');
  }

  const response = await fetch(OPENAI_SPEECH_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.openaiTextToSpeechModel,
      voice: env.openaiTextToSpeechVoice,
      input: text,
      instructions: env.openaiTextToSpeechInstructions,
      response_format: 'wav',
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    const status = response.status >= 400 && response.status < 500 ? response.status : 502;
    throw new HttpError(status, `OpenAI text-to-speech request failed: ${message}`);
  }

  return Buffer.from(await response.arrayBuffer());
};

const synthesizeGroqSpeech = async (text: string): Promise<Buffer> => {
  const client = getGroqClient();

  try {
    const response = await client.audio.speech.create({
      model: env.textToSpeechModel,
      voice: env.textToSpeechVoice,
      input: text,
      response_format: 'wav',
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (caught) {
    if (caught instanceof Groq.APIError) {
      const status =
        caught.status && caught.status >= 400 && caught.status < 500 ? caught.status : 502;
      throw new HttpError(status, `Text-to-speech request failed: ${caught.message}`);
    }
    throw caught;
  }
};
