import Groq from 'groq-sdk';

import { env } from '../../config/env.js';
import { HttpError } from '../../shared/http-error.js';

let client: Groq | undefined;

/**
 * Lazily-constructed singleton so the server can boot without an API key
 * (e.g. for local frontend-only work) and fail loudly only when an LLM
 * call is actually attempted.
 */
export const getGroqClient = (): Groq => {
  if (!env.groqApiKey) {
    throw new HttpError(
      503,
      'GROQ_API_KEY is not configured. Set it in backend/.env to enable the Interviewer Decision Engine. ' +
        'Get a free key at https://console.groq.com/keys.',
    );
  }

  if (!client) {
    client = new Groq({ apiKey: env.groqApiKey });
  }

  return client;
};
