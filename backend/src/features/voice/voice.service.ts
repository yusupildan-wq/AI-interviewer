import Groq, { toFile } from 'groq-sdk';

import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http-error.js';
import { getGroqClient } from '../llm/groq-client.js';

const MAX_TTS_CHARS = 2000;

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
      const status = caught.status && caught.status >= 400 && caught.status < 500 ? caught.status : 502;
      throw new HttpError(status, `Speech-to-text request failed: ${caught.message}`);
    }
    throw caught;
  }
};

export const synthesizeSpeech = async (text: string): Promise<Buffer> => {
  const client = getGroqClient();
  const trimmed = text.trim().slice(0, MAX_TTS_CHARS);

  if (!trimmed) {
    throw new HttpError(400, 'No text provided to synthesize.');
  }

  try {
    const response = await client.audio.speech.create({
      model: env.textToSpeechModel,
      voice: env.textToSpeechVoice,
      input: trimmed,
      response_format: 'wav',
    });
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (caught) {
    if (caught instanceof Groq.APIError) {
      const status = caught.status && caught.status >= 400 && caught.status < 500 ? caught.status : 502;
      throw new HttpError(status, `Text-to-speech request failed: ${caught.message}`);
    }
    throw caught;
  }
};
